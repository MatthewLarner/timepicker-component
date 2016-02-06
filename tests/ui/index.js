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
        t.plan(2);

        driver()
            .focus('hours', 'field')
            .pressKeys('10')
            .blur()
            .go(function(error, result) {
                t.ok(result, 'interaction complete');
                t.equal(timePicker.hours(), 10, 'value set correctly');
            });
    });
};
