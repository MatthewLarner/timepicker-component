var test = require('tape'),
    driver = require('automagic-ui'),
    createTimePicker = require('../../'),
    fastn = require('fastn')({
        _generic: require('fastn/genericComponent'),
        text: require('fastn/textComponent')
    }),
    model = {};

window.onload = function() {
    var timePicker = createTimePicker(),
        timeBinding = fastn.binding('time|*', function(time){
            return time ? 'Time is set to ' + time : '';
        }).attach(model),
        timeLabel = fastn('label', timeBinding);

    timeLabel.attach(model).render();

    document.body.appendChild(timePicker.element);
    document.body.appendChild(timeLabel.element);

    timePicker.time.on('change', function(time){
        fastn.Model.store(model, 'time', time);
    });

    driver.init({
        runDelay: 2000
    });

    test('timepicker elements are in view', function(t){
        t.plan(1);

        driver()
            .findUi('hours', 'field')
            .findUi('minutes', 'field')
            .findUi('seconds', 'field')
            .findUi('meridiem', 'field')
            .go(function(error, result){
                t.ok(result, 'found timepicker elements');
            });
    });

    test('state', function(t) {
        t.plan(3);

        driver()
            .changeValue('hours', 'field', '10')
            .changeValue('minutes', 'field', '10')
            .changeValue('seconds', 'field', '10')
            .go(function(error, result) {
                if(error) {
                    console.log(error);
                }

                t.equal(timePicker.hours(), 10, 'hours set correctly');
                t.equal(timePicker.minutes(), 10, 'minutes set correctly');
                t.equal(timePicker.seconds(), 10, 'seconds set correctly');
            });
    });

};
