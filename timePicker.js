var doc = require('doc-js'),
    crel = require('crel'),
    morrison = require('morrison'),
    placeholder = placeholder,
    hoursRegex = /^[1-9]$|^0[1-9]$|^1[0-2]$/,
    minutesSecondsRegex = /^[0-5][0-9]$|^[0-9]$/,
    meridiemRegex = /^am$|^pm$|^AM$|^PM$/,
    timeRegex = /(0[1-9]|1[0-2]):([0-5][0-9]):([0-5][0-9]) (AM|PM)/;

function createInputSpan(settings){
    return crel('input', {
            class: settings.class,
            title: settings.class
        },
        settings.placeholder
    );
}

function propertySet(value) {
    return value >= 0 && value !== '' && value != null;
}

function intToString(value){
    var result = value.toString();
    result = result.length === 1 ? '0' + result : result;

    return result;
}


function valueChange(component) {
    if(!component.element){
        return;
    }

    var hours = component.hours(),
        minutes = component.minutes(),
        seconds = component.seconds(),
        meridiem = component.meridiem(),
        time = '';

    if(!propertySet(hours) || !propertySet(minutes) || !propertySet(seconds) || !meridiem) {
        component.valid(false);
        return;
    } else {
        component.valid(true);
        time = intToString(hours) + ':' + intToString(minutes) + ':' + intToString(seconds) + ' ' + meridiem;
    }

    component.time(time);
    component.hoursInput.value = hours;
    component.minutesInput.value = minutes;
    component.secondsInput.value = seconds;
    component.meridiemInput.value = meridiem;
}

module.exports = function(fastn, component, type, settings, children){
    component.extend('_generic', settings, children);
    component.setProperty('valid');

    function setInputProperty(key, input, regex){
        component.setProperty(key, fastn.property(null, function(value) {
            var validValue = regex.test(value);
            input.value = validValue ? value : '';
            if(!validValue) {
                component[key](null);
            }
            valueChange(component);
        }));
    }

    component.hoursInput = createInputSpan({
        class: 'hours'
    });

    component.minutesInput = createInputSpan({
        class: 'minutes'
    });

    component.secondsInput = createInputSpan({
        class: 'seconds'
    });

    component.meridiemInput = crel('select', {
            class: 'meridiem',
            title: 'meridiem'
        },
        crel('option', {value: 'AM'}, 'AM'),
        crel('option', {value: 'PM'}, 'PM')
    );

    setInputProperty('hours', component.hoursInput, hoursRegex);
    setInputProperty('minutes', component.minutesInput, minutesSecondsRegex);
    setInputProperty('seconds', component.secondsInput, minutesSecondsRegex);
    setInputProperty('meridiem', component.meridiemInput, meridiemRegex);

    component.setProperty('time', fastn.property(null, function update(time){
        if(!time){
            return;
        }

        var match = time.match(timeRegex);

        if(!match) {
            component.hours(null);
            component.minutes(null);
            component.seconds(null);
            component.meridiem(null);
        } else {
            component.hours(parseInt(match[1]));
            component.minutes(parseInt(match[2]));
            component.seconds(parseInt(match[3]));
            component.meridiem(match[4]);
        }
        valueChange(component);
    }));

    component.on('change', valueChange.bind(null, component));
    component.on('attach', valueChange.bind(null, component));

    component.render = function() {
        component.element = crel('span', {class: 'timePicker'},
            component.hoursInput,
            crel('span',
                {class: 'seperator'},
                ':'
            ),
            component.minutesInput,
            component.secondsInput,
            component.meridiemInput
        );

        var docComponent = doc(component.componentElement),
            docHours = doc(component.hoursInput),
            docMinutes = doc(component.minutesInput),
            docSeconds = doc(component.secondsInput),
            docMeridiem = doc(component.meridiemInput);

        component.meridiem('AM');

        docHours.on('change', function(event) {
            component.hours(component.hoursInput.value);
        });

        docMinutes.on('change', function(event) {
            component.minutes(component.minutesInput.value);
        });

        docSeconds.on('change', function(event) {
            component.seconds(component.secondsInput.value);
        });

        docMeridiem.on('change', function(event) {
            component.meridiem(component.meridiemInput.value);
        });

        docHours.on('focus', function(event) {
            docComponent.addClass('focus');
        });

        docMinutes.on('focus', function(event) {
            docComponent.addClass('focus');
        });

        docSeconds.on('focus', function(event) {
            docComponent.addClass('focus');
        });

        docMeridiem.on('focus', function(event) {
            docComponent.addClass('focus');
        });

        docHours.on('blur', function(event) {
            docComponent.removeClass('focus');
        });

        docMinutes.on('blur', function(event) {
            docComponent.removeClass('focus');
        });

        docSeconds.on('blur', function(event) {
            docComponent.removeClass('focus');
        });

        docMeridiem.on('blur', function(event) {
            docComponent.removeClass('focus');
        });

        morrison({
            parentElement: component.element,
            validators: {
                '.timePicker .hours': /^0?[0-9]$|^[0-1][0-2]$/,
                '.timePicker .minutes': /^0?[0-9]$|^[0-5][0-9]$/,
                '.timePicker .seconds': /^0?[0-9]$|^[0-5][0-9]$/
            }
        });

        component.emit('render');
        return component;
    };

    return component;
};

module.exports.expectedComponents = ['_generic'];
