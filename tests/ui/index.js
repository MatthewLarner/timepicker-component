var test = require('tape'),
    driver = require('automagic-ui'),
    createTimePicker = require('../../');

window.onload = function() {
    var timePicker = createTimePicker();
    timePicker.element._component = timePicker;
    document.body.appendChild(timePicker.element);

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

    test('valid values set correctly', function(t) {
        t.plan(1);

        driver()
            .focus('hours', 'field')
            .pressKeys('10')
            .focus('minutes', 'field')
            .pressKeys('10')
            .focus('seconds', 'field')
            .pressKeys('10')
            .focus('meridiem', 'field')
            .pressKeys('PM')
            .go(function(error, result) {
                t.ok(result, 'time elements can be interacted with');
            });
    });
};
