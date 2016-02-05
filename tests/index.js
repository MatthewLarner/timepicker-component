var test = require('tape'),
    createTimePicker = require('../');

test('timePicker exists', function(t){
    t.plan(2);

    var timePicker = createTimePicker();

    t.ok(timePicker, 'timePicker exists');
    t.ok(timePicker.element, 'timePicker element exists');
});

test('set a valid time', function(t){
    t.plan(5);

    var timePicker = createTimePicker(),
        testTime = '12:45:00 AM';

    timePicker.time(testTime);

    t.equal(timePicker.time(), '12:45:00 AM', 'Time set correctly');
    t.equal(timePicker.hours(), '12', 'Hours set correctly');
    t.equal(timePicker.minutes(), '45', 'Minutes set correctly');
    t.equal(timePicker.seconds(), '00', 'Seconds set correctly');
    t.equal(timePicker.meridiem(), 'AM', 'Meridiem set correctly');
});
