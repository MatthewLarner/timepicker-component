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
};
