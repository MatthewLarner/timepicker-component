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
    t.equal(timePicker.hours(), 12, 'hours set correctly');
    t.equal(timePicker.minutes(), 45, 'minutes set correctly');
    t.equal(timePicker.seconds(), 0, 'seconds set correctly');
    t.equal(timePicker.meridiem(), 'AM', 'meridiem set correctly');
});

test('set a standard valid time', function(t){
    t.plan(10);

    var timePicker = createTimePicker(),
        testTime = new Date('1/1/2011 12:45:00').toTimeString();

    timePicker.time(testTime);

    t.equal(timePicker.time(), '12:45:00 AM', 'Time set correctly');
    t.equal(timePicker.hours(), 12, 'hours set correctly');
    t.equal(timePicker.minutes(), 45, 'minutes set correctly');
    t.equal(timePicker.seconds(), 0, 'seconds set correctly');
    t.equal(timePicker.meridiem(), 'AM', 'meridiem set correctly');

    var testTime2 = new Date('1/1/2011 22:45:00').toTimeString();

    timePicker.time(testTime2);

    t.equal(timePicker.time(), '10:45:00 PM', 'Time set correctly');
    t.equal(timePicker.hours(), 10, 'hours set correctly');
    t.equal(timePicker.minutes(), 45, 'minutes set correctly');
    t.equal(timePicker.seconds(), 0, 'seconds set correctly');
    t.equal(timePicker.meridiem(), 'PM', 'meridiem set correctly');
});

test('set valid parts', function(t) {
    t.plan(5);

    var timePicker = createTimePicker(),
        expectedTime = '10:30:20 PM';

    timePicker.hours(10);
    t.equal(timePicker.hours(), 10, 'hours set correctly');

    timePicker.minutes(30);
    t.equal(timePicker.minutes(), 30, 'minutes set correctly');

    timePicker.seconds(20);
    t.equal(timePicker.seconds(), 20, 'seconds set correctly');

    timePicker.meridiem('PM');
    t.equal(timePicker.meridiem(), 'PM', 'meridiem set correctly');


    t.equal(timePicker.time(), expectedTime);
});

test('set single digit values', function(t) {
    t.plan(5);

    var timePicker = createTimePicker(),
        expectedTime = '01:03:00 AM';

    timePicker.hours(1);
    t.equal(timePicker.hours(), 1, 'hours set correctly');

    timePicker.minutes(3);
    t.equal(timePicker.minutes(), 3, 'minutes set correctly');

    timePicker.seconds(0);
    t.equal(timePicker.seconds(), 0, 'seconds set correctly');

    timePicker.meridiem('AM');
    t.equal(timePicker.meridiem(), 'AM', 'meridiem set correctly');


    t.equal(timePicker.time(), expectedTime);
});
