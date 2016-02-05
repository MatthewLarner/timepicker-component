var doc = require('doc-js'),
    crel = require('crel'),
    morrison = require('morrison'),
    placeholder = placeholder,
    hoursRegex = /^0[1-9]$|^1[0-2]$/,
    minutesRegex = /^[0-5][0-9]$/,
    meridiemRegex = /^am$|^pm$|^AM$|^PM$/,
    timeRegex = /(0[1-9]|1[0-2]):([0-5][0-9]):[0-5][0-9] (AM|PM)/;

function createInputSpan(settings){
    return crel('input', {
            class: settings.class,
            'data-sanitise': settings.sanitise
        },
        settings.placeholder
    );
}

module.exports = function(fastn, component, type, settings, children){
    component.extend('_generic', settings, children);
    component.setProperty('hours', fastn.property(null, function(value) {
        component.hoursInput.value = hoursRegex.test(value) ? value : '';
    }));
    component.setProperty('minutes', fastn.property(null, function(value) {
        component.minutesInput.value = minutesRegex.test(value) ? value : '';
    }));
    component.setProperty('meridiem', fastn.property(null, function(value) {
        component.meridiemInput.value = meridiemRegex.test(value) ? value.toUpperCase() : '';
    }));

    component.setProperty('time', fastn.property(null, function update(time){
        if(!time){
            return;
        }

        var match = time.match(timeRegex);

        if(!match) {
            component.hours('');
            component.minutes('');
            component.meridiem('');
        } else {
            component.hours(match[1]);
            component.minutes(match[2]);
            component.meridiem(match[3]);
        }
        valueChange();
    }));

    component.hoursInput = createInputSpan({
        class: 'hours',
        sanitise: /^0?[0-9]$|^[0-1][0-2]$/
    });

    component.minutesInput = createInputSpan({
        class: 'minutes',
        sanitise: /^0?[0-9]$|^[0-5][0-9]$/
    });

    component.meridiemInput = crel('select', {
            class: 'meridiem',
        },
        crel('option', {value: 'AM'}, 'AM'),
        crel('option', {value: 'PM'}, 'PM')
    );

    function valueChange() {
        if(!component.element){
            return;
        }

        var hours = component.hours(),
            minutes = component.minutes(),
            meridiem = component.meridiem(),
            time = '';

        if(!hours || !minutes || !meridiem) {
            return;
        } else {
            time = hours + ':' + minutes + ':00 ' + meridiem;
        }

        component.time(time);
        component.hoursInput.value = hours;
        component.minutesInput.value = minutes;
        component.meridiemInput.value = meridiem;
    }

    component.on('change', valueChange);
    component.on('attach', valueChange);

    component.render = function() {
        component.element = crel('span', {class: 'timePicker'},
            component.hoursInput,
            crel('span',
                {class: 'seperator'},
                ':'
            ),
            component.minutesInput,
            component.meridiemInput
        );

        var docComponent = doc(component.componentElement),
            docHours = doc(component.hoursInput),
            docMinutes = doc(component.minutesInput),
            docMeridiem = doc(component.meridiemInput);

        component.meridiem('AM');

        docHours.on('change', function(event) {
            component.hours(component.hoursInput.value);
        });

        docMinutes.on('change', function(event) {
            component.minutes(component.minutesInput.value);
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

        docMeridiem.on('focus', function(event) {
            docComponent.addClass('focus');
        });

        docHours.on('blur', function(event) {
            docComponent.removeClass('focus');
        });

        docMinutes.on('blur', function(event) {
            docComponent.removeClass('focus');
        });

        docMeridiem.on('blur', function(event) {
            docComponent.removeClass('focus');
        });

        morrison({
            parentElement: component.element,
            validators: {
                '.timePicker .hours': /^0?[0-9]$|^[0-1][0-2]$/,
                '.timePicker .minutes': /^0?[0-9]$|^[0-5][0-9]$/
            }
        });

        component.emit('render');
    };

    return component;
};

module.exports.expectedComponents = ['_generic'];
