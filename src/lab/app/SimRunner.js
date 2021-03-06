// Copyright 2016 Erik Neumann.  All Rights Reserved.
//
// Licensed under the Apache License, Version 2.0 (the 'License');
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an 'AS IS' BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

goog.provide('myphysicslab.lab.app.SimRunner');

goog.require('goog.asserts');
goog.require('goog.events');
goog.require('myphysicslab.lab.model.AdvanceStrategy');
goog.require('myphysicslab.lab.util.Clock');
goog.require('myphysicslab.lab.util.AbstractSubject');
goog.require('myphysicslab.lab.util.ErrorObserver');
goog.require('myphysicslab.lab.util.GenericEvent');
goog.require('myphysicslab.lab.util.MemoList');
goog.require('myphysicslab.lab.util.Memorizable');
goog.require('myphysicslab.lab.util.Observer');
goog.require('myphysicslab.lab.util.ParameterBoolean');
goog.require('myphysicslab.lab.util.ParameterNumber');
goog.require('myphysicslab.lab.util.Timer');
goog.require('myphysicslab.lab.util.UtilityCore');
goog.require('myphysicslab.lab.view.LabCanvas');

goog.scope(function() {

var AdvanceStrategy = myphysicslab.lab.model.AdvanceStrategy;
var Clock = myphysicslab.lab.util.Clock;
var AbstractSubject = myphysicslab.lab.util.AbstractSubject;
var ErrorObserver = myphysicslab.lab.util.ErrorObserver;
var GenericEvent = myphysicslab.lab.util.GenericEvent;
var LabCanvas = myphysicslab.lab.view.LabCanvas;
var NF = myphysicslab.lab.util.UtilityCore.NF;
var NF7 = myphysicslab.lab.util.UtilityCore.NF7;
var ParameterBoolean = myphysicslab.lab.util.ParameterBoolean;
var ParameterNumber = myphysicslab.lab.util.ParameterNumber;
var Timer = myphysicslab.lab.util.Timer;
var UtilityCore = myphysicslab.lab.util.UtilityCore;

/** Uses an {@link myphysicslab.lab.model.AdvanceStrategy AdvanceStrategy} to
advance the {@link myphysicslab.lab.model.Simulation Simulation} state;
the process is driven by a {@link myphysicslab.lab.util.Timer Timer} and a
{@link myphysicslab.lab.util.Clock Clock} to synchronize the Simulation with real time;
updates the {@link myphysicslab.lab.view.LabCanvas LabCanvas} to show
the current Simulation state.

Parameters Created
------------------

+ ParameterNumber named `SimRunner.en.TIME_STEP`
  see {@link #setTimeStep}

+ ParameterNumber named `SimRunner.en.DISPLAY_PERIOD`
  see {@link #setDisplayPeriod}

+ ParameterBoolean named `SimRunner.en.RUNNING`
  see {@link #setRunning}


Events Broadcast
----------------
All the Parameters are broadcast when their values change.  In addition:

+ GenericEvent named {@link SimRunner.RESET}


How Simulation Advances with Clock
----------------------------------

SimRunner advances the Simulation state, keeping it in sync with the Clock time, and
therefore we see the Simulation advancing in real time.  Here are the details:

+ The Timer **callback** is set to be the SimRunner method {@link #callback}.

+ The `callback()` method **reschedules itself** to run again by
calling `Timer.finishAt()` or `Timer.fireAfter()` thus continuing the
{@link myphysicslab.lab.util.Timer chain of callbacks}.
The callback reschedules itself regardless of whether the Clock is paused,
stepping, or running (though it calculates the delay differently in those cases).

+ When the Clock is **running or stepping**, `callback()` advances the
Simulation up to (or just beyond) the current clock time (from `Clock.getTime()`) by
calling `AdvanceStrategy.advance()`. This keeps the
Simulation in sync with the Clock and therefore (hopefully) with real time.

+ **Stepping** forward by a single time step employs the special
{@link myphysicslab.lab.util.Clock step mode} of Clock. When `callback()`
sees the Clock is in step mode, it advances the Simulation by a single time step
and then clears the Clock's step mode so that the Clock will thereafter be in the
regular 'paused' state.

+ Sometimes the Simulation cannot be computed in real time. In that case
`callback()` will **retard the clock time** when it is too far ahead of
simulation time, by calling `Clock.setTime()`. Once that happens `Clock.getRealTime()`
will be greater than `Clock.getTime()`. We can calculate how much time has been lost
due to performance problems by comparing these.

+ When the Clock is **paused** `callback()` still updates the LabCanvas, so
any changes to objects will be seen. The callback chain continues to be rescheduled with
`Timer.fireAfter()`, but the Clock time is frozen. This allows the user to position
objects while the simulation is paused.

+ The Timer period (the callback frequency) determines the **frame rate** of the
simulation display, because a new frame is drawn each time the `callback()`
callback fires. See {@link #setDisplayPeriod}.

+ The Timer period has no effect on how often the Simulation's
differential equation is calculated; that is determined separately by the **time step**
used when calling `AdvanceStrategy.advance()`. See {@link #setTimeStep}.

* @param {!myphysicslab.lab.model.AdvanceStrategy} advance  the AdvanceStrategy which
*     runs advances the Simulation
* @param {string=} opt_name name of this SimRunner.
* @constructor
* @final
* @struct
* @implements {myphysicslab.lab.util.Observer}
* @implements {myphysicslab.lab.util.MemoList}
* @extends {myphysicslab.lab.util.AbstractSubject}
*/
myphysicslab.lab.app.SimRunner = function(advance, opt_name) {
  AbstractSubject.call(this, opt_name || 'SIM_RUNNER');
  /** The AdvanceStrategys to run.
  * @type {!Array<!AdvanceStrategy>}
  * @private
  */
  this.advanceList_ = [advance];
  /** Amount of time to advance the simulation, in seconds.
  * @type {number}
  * @private
  */
  this.timeStep_ = advance.getTimeStep();
  /** Amount of time between displaying frames of the simulation, in seconds.
  * @type {number}
  * @private
  */
  this.displayPeriod_ = 0.025;
  /**
  * @type {!myphysicslab.lab.util.Timer}
  * @private
  */
  this.timer_ = new Timer();
  this.timer_.setPeriod(this.displayPeriod_);
  this.timer_.setCallBack(goog.bind(this.callback, this));
  // Clock name should be just 'CLOCK' when opt_name is not specified.
  // When opt_name is specified, prefix it to the clock name.
  var clockName = (opt_name ? opt_name + '_' : '')+'CLOCK';
  /**
  * @type {!myphysicslab.lab.util.Clock}
  * @private
  */
  this.clock_ = new Clock(clockName);
  // set Clock to match simulation time.
  var t = advance.getTime();
  this.clock_.setTime(t);
  this.clock_.setRealTime(t);
  this.clock_.addObserver(this);
  /**
  * @type {!Array<!myphysicslab.lab.view.LabCanvas>}
  * @private
  */
  this.canvasList_ = [];
  /**
  * @type {Array<!myphysicslab.lab.util.Memorizable>}
  * @private
  */
  this.memorizables_ = [];
  /**
  * @type {Array<!myphysicslab.lab.util.ErrorObserver>}
  * @private
  */
  this.errorObservers_ = [];
  /**
  * @type {boolean}
  * @private
  */
  this.debugTiming_ = false;
  this.addParameter(new ParameterNumber(this, SimRunner.en.TIME_STEP,
      SimRunner.i18n.TIME_STEP,
      this.getTimeStep, this.setTimeStep).setSignifDigits(3));
  this.addParameter(new ParameterNumber(this, SimRunner.en.DISPLAY_PERIOD,
      SimRunner.i18n.DISPLAY_PERIOD,
      this.getDisplayPeriod, this.setDisplayPeriod).setSignifDigits(3));
  this.addParameter(new ParameterBoolean(this, SimRunner.en.RUNNING,
      SimRunner.i18n.RUNNING,
      this.getRunning, this.setRunning));
  goog.asserts.setErrorHandler(
    goog.bind(
      function(a){
        console.log(a + ' stack= '+a.stack);
        this.clock_.pause();
        throw a;
      },this)
  );
};
var SimRunner = myphysicslab.lab.app.SimRunner;
goog.inherits(SimRunner, AbstractSubject);

if (!UtilityCore.ADVANCED) {
  /** @inheritDoc */
  SimRunner.prototype.toString = function() {
    return this.toStringShort().slice(0, -1)
        +', advanceList_: ['
        + goog.array.map(this.advanceList_, function(a) { return a.toStringShort(); })
        +'], clock_: '+this.clock_.toStringShort()
        +', timer_: '+this.timer_
        +', timeStep_: '+NF(this.timeStep_)
        +', displayPeriod_: '+NF(this.displayPeriod_)
        +', canvasList_: ['
        + goog.array.map(this.canvasList_, function(a) { return a.toStringShort(); })
        +'], memorizables_: ['
        + goog.array.map(this.memorizables_, function(a) { return a.toStringShort(); })
        +']'
        + SimRunner.superClass_.toString.call(this);
  };
}

/** @inheritDoc */
SimRunner.prototype.getClassName = function() {
  return 'SimRunner';
};

/** Adds the LabCanvas to the list of LabCanvas's that need to be
repainted and memorized after each advance of the Simulation.
@param {!myphysicslab.lab.view.LabCanvas} canvas the LabCanvas to add to the list of
    LabCanvas's to update
*/
SimRunner.prototype.addCanvas = function(canvas) {
  if (!goog.array.contains(this.canvasList_, canvas)) {
    this.canvasList_.push(canvas);
    this.addMemo(canvas);
  }
};

/** Adds an object to the list of ErrorObserver objects to be notified when an
error occurs.
@param {!myphysicslab.lab.util.ErrorObserver} errorObserver object to add to the list of
    ErrorObserver objects
*/
SimRunner.prototype.addErrorObserver = function(errorObserver) {
  if (!goog.array.contains(this.errorObservers_, errorObserver)) {
    this.errorObservers_.push(errorObserver);
  }
};

/** @inheritDoc */
SimRunner.prototype.addMemo = function(memorizable) {
  if (!goog.array.contains(this.memorizables_, memorizable)) {
    this.memorizables_.push(memorizable);
  }
};

/** Adds an AdvanceStrategy to the set being advanced.
* @param {!myphysicslab.lab.model.AdvanceStrategy} advance  the AdvanceStrategy to add
*/
SimRunner.prototype.addStrategy = function(advance) {
  this.advanceList_.push(advance);
};

/** Advances the simulation(s) to the target time and calls `memorize` on the list of
Memorizables after each time step.
* @param {!AdvanceStrategy} strategy  the AdvanceStrategy which advances the simulation
* @param {number} targetTime the time to advance to
* @private
*/
SimRunner.prototype.advanceSims = function(strategy, targetTime) {
  var  simTime = strategy.getTime();
  while (simTime < targetTime) {
    // the AdvanceStrategy is what actually calls `memorize`
    strategy.advance(this.timeStep_, /*memoList=*/this);
    // Prevent infinite loop when time doesn't advance.
    var lastSimTime = simTime;
    simTime = strategy.getTime();
    if (simTime - lastSimTime <= 1e-15) {
      throw new Error('SimRunner time did not advance');
    }
    if (this.debugTiming_ && goog.DEBUG) {
      var clockTime = this.clock_.getTime();
      console.log(NF(strategy.getTime())
        +' now='+NF(clockTime)
        +' targetTime='+NF(targetTime)
        +' timeStep='+NF(this.timeStep_)
        );
    }
  }
};

/** Advances the Simulation AdvanceStrategy(s) to match the current Clock time and
repaints the LabCanvas's. Calls `memorize` on the list of Memorizables after each time
step. This is the callback function that is being run by the
{@link myphysicslab.lab.util.Timer Timer}. Reschedules itself to run again, to continue
the {@link myphysicslab.lab.util.Timer chain of callbacks}.
* @return {undefined}
*/
SimRunner.prototype.callback = function() {
  try {
    this.timer_.callBackStarted();
    if (!this.clock_.isRunning() && !this.clock_.isStepping()) {
      this.timer_.fireAfter(this.displayPeriod_);
    } else {
      var clockTime = this.clock_.getTime();
      var simTime = this.advanceList_[0].getTime();
      // If clockTime is VERY far ahead or behind of simTime, assume simTime was
      // intentionally modified. Match clock to simTime, but just a little ahead
      // by a timeStep so that the simulation advances.
      if (clockTime > simTime + 1 || clockTime < simTime - 1) {
        var t = simTime + this.timeStep_;
        this.clock_.setTime(t);
        this.clock_.setRealTime(t);
        clockTime = t;
      }
      var startTime = clockTime;
      if (goog.DEBUG && this.debugTiming_) {
        var expectedTime = this.clock_.systemToClock(this.timer_.getExpectedTime());
        console.log(NF(simTime)
            +' callback '
            +' simTime='+NF(simTime)
            +' clockTime='+NF(clockTime)
            +' timeStep_='+NF(this.timeStep_)
            +' expected='+NF(expectedTime)
            +' stepMode='+this.clock_.isStepping()
            +' running='+this.clock_.isRunning()
            );
          //  +' late='+NF(startTime - expectedTime)
          //  +' sys='+NF(UtilityCore.chopTime(UtilityCore.getSystemTime()))
      }
      // If sim reaches almost current clock time, that is good enough.
      var targetTime = startTime - this.timeStep_/10;
      for (var i=0, n=this.advanceList_.length; i<n; i++) {
        this.advanceSims(this.advanceList_[i], targetTime);
      }
      if (this.clock_.isStepping()) {
        // When stepping, just fire the next callback after displayPeriod time;
        // don't care about elapsed time or getting behind the clock.
        this.timer_.fireAfter(this.displayPeriod_);
        this.clock_.clearStepMode();
      } else {
        clockTime = this.clock_.getTime();
        simTime = this.advanceList_[0].getTime();
        var limit = 20*this.timeStep_;
        var retard = clockTime - simTime > limit;
        if (this.debugTiming_ && goog.DEBUG) {
          // elapsedTime = how long it took to calculate the frames
          console.log(NF(simTime)
            +(retard ? ' ### retard labTimer ': '')
            +' now='+NF(clockTime)
            +' behind='+NF(clockTime - simTime)
            +' limit='+NF(limit)
            +' elapsed='+NF(clockTime - startTime)
            );
        }
        if (retard) {
          // Retard the clock because we are too far behind.
          this.clock_.setTime(simTime);
          this.timer_.fireAfter(0);
        } else {
          // we want the next callback to finish at simTime + displayPeriod
          var t = simTime + this.displayPeriod_*this.clock_.getTimeRate();
          this.timer_.finishAt(this.clock_.clockToSystem(t));
        }
      }
    }
    this.paintAll();
  } catch(ex) {
    this.handleException(ex);
    // unclear why, but restart timer here helps after getting the exception
    // in DangleStickApp.
    this.timer_.fireAfter();
  }
};

/** Returns the list of LabCanvas's that need to be repainted after each advance of the
Simulation.
* @return {!Array<!myphysicslab.lab.view.LabCanvas>} the list of LabCanvas that need
*   to be repainted
*/
SimRunner.prototype.getCanvasList = function() {
  return goog.array.clone(this.canvasList_);
};

/** Returns the Clock which the Simulation is synchronized to.
* @return {!myphysicslab.lab.util.Clock} the Clock which the Simulation is synchronized
*    to.
*/
SimRunner.prototype.getClock = function() {
  return this.clock_;
};

/** Returns the amount of time between callbacks which display frames of the Simulation,
in seconds.
@return {number} amount of time between callbacks, in seconds
*/
SimRunner.prototype.getDisplayPeriod = function() {
  return this.displayPeriod_;
};

/** @inheritDoc */
SimRunner.prototype.getMemos = function() {
  return goog.array.clone(this.memorizables_);
};

/** Returns true if the Clock is running.
@return {boolean} true if the Clock is running
*/
SimRunner.prototype.getRunning = function() {
  return this.clock_.isRunning();
};

/** Returns the small increment of time by which to advance the Simulation's state.
Several steps of this size may be taken to advance the Simulation time to be equal to or
beyond the Clock time.
@return {number} the length of a time step, in seconds.
*/
SimRunner.prototype.getTimeStep = function() {
  return this.timeStep_;
};

/** Presents an alert to the user about the exception with instructions about how to
* get the Simulation running again; calls `SimRunner.pause()` to stop the Simulation.
* @param {*} error the error that caused the exception
* @protected
*/
SimRunner.prototype.handleException = function(error) {
  if (goog.DEBUG) {
    console.log('SimRunner.handleException '+error);
    window.console.trace();
  }
  this.pause();
  goog.array.forEach(this.errorObservers_, function(e) { e.notifyError(error); });
  var s = goog.isDefAndNotNull(error) ? ' '+error : '';
  alert(SimRunner.i18n.STUCK + s);
};

/** Whether the Timer is executing the `callback()` callback.
@return {boolean}
*/
SimRunner.prototype.isFiring = function() {
  return this.timer_.isFiring();
};

/** @inheritDoc */
SimRunner.prototype.memorize = function() {
  goog.array.forEach(this.memorizables_, function(c) { c.memorize(); });
};

/** @inheritDoc */
SimRunner.prototype.observe =  function(event) {
  if (event.getSubject() == this.clock_) {
    if (event.nameEquals(Clock.CLOCK_RESUME) || event.nameEquals(Clock.CLOCK_PAUSE)) {
      // sync clock to simulation time
      var t = this.advanceList_[0].getTime();
      this.clock_.setTime(t);
      this.clock_.setRealTime(t);
      this.broadcastParameter(SimRunner.en.RUNNING);
    } else if (event.nameEquals(Clock.CLOCK_SET_TIME)) {
      this.memorize();
    }
  }
};

/** Paints all the LabCanvas's, which causes them to redraw their contents.
* @return {undefined}
*/
SimRunner.prototype.paintAll = function() {
  goog.array.forEach(this.canvasList_, function(c) {
    c.paint();
  });
};

/** Pause the Clock, which therefore also pauses the Simulation.
@return {undefined}
*/
SimRunner.prototype.pause = function() {
  this.clock_.pause();
};

/** Remove the LabCanvas from the list of LabCanvas's that need to be
repainted and memorized after each advance of the Simulation.
@param {!myphysicslab.lab.view.LabCanvas} canvas the LabCanvas to remove from the list
    of LabCanvas's to update
*/
SimRunner.prototype.removeCanvas = function(canvas) {
  goog.array.remove(this.canvasList_, canvas);
  this.removeMemo(canvas);
};

/** Removes an object from the list of ErrorObserver objects to be notified when an
error occurs.
@param {!myphysicslab.lab.util.ErrorObserver} errorObserver object to remove from
    the list of ErrorObserver objects
*/
SimRunner.prototype.removeErrorObserver = function(errorObserver) {
  goog.array.remove(this.errorObservers_, errorObserver);
};

/** @inheritDoc */
SimRunner.prototype.removeMemo = function(memorizable) {
  goog.array.remove(this.memorizables_, memorizable);
};

/** Sets the Simulation to its initial conditions by calling
{@link myphysicslab.lab.model.AdvanceStrategy#reset},
sets the Clock to match the simulation time (usually zero),
and pauses the Clock. Broadcasts a {@link SimRunner.RESET} event.
* @return {undefined}
*/
SimRunner.prototype.reset = function() {
  goog.array.forEach(this.advanceList_, function(strategy) {
    strategy.reset();
  });
  // sync clock to simulation time
  var t = this.advanceList_[0].getTime();
  this.clock_.setTime(t);
  this.clock_.setRealTime(t);
  this.clock_.pause();
  this.paintAll();
  this.broadcast(new GenericEvent(this, SimRunner.RESET));
};

/** Resume the Clock, which therefore also resumes advancing the Simulation.
@return {undefined}
*/
SimRunner.prototype.resume = function() {
  this.clock_.resume();
};

/** Sets amount of time between callbacks which display frames of the Simulation, in
seconds.  This determines the frame rate of the simulation display.
@param {number} displayPeriod amount of time between callbacks, in seconds
*/
SimRunner.prototype.setDisplayPeriod = function(displayPeriod) {
  this.displayPeriod_ = displayPeriod;
  this.timer_.setPeriod(displayPeriod);
  this.broadcastParameter(SimRunner.en.DISPLAY_PERIOD);
};

/** Sets whether the Clock is running or paused.
@param {boolean} value true means the Clock will be running
*/
SimRunner.prototype.setRunning = function(value) {
  if (value) {
    this.resume();
  } else {
    this.pause();
  }
};

/** Sets the length of a time step, the small increment of time by which to
advance the Simulation's state.  Several steps of this size may be taken to advance the
Simulation time to be equal to or beyond the Clock time.
@param {number} timeStep the length of a time step, in seconds.
*/
SimRunner.prototype.setTimeStep = function(timeStep) {
  this.timeStep_ = timeStep;
  this.broadcastParameter(SimRunner.en.TIME_STEP);
};

/** Starts the Timer executing the `callback()` callback.
@return {undefined}
*/
SimRunner.prototype.startFiring = function() {
  this.timer_.fireAfter();
};

/** Steps the Clock and Simulation forward by a single timestep.
@return {undefined}
*/
SimRunner.prototype.step = function() {
  //this.clock_.pause();
  // advance clock to be exactly one timeStep past current sim time
  var dt = this.advanceList_[0].getTime() + this.timeStep_ - this.clock_.getTime();
  this.clock_.step(dt);
};

/** Stops the Timer from executing the `callback()` callback.
@return {undefined}
*/
SimRunner.prototype.stopFiring = function() {
  this.timer_.stopFiring();
};

/** Name of GenericEvent that is broadcast when {@link #reset} method occurs.
* @type {string}
* @const
*/
SimRunner.RESET = 'RESET';

/** Set of internationalized strings.
@typedef {{
  TIME_STEP: string,
  DISPLAY_PERIOD: string,
  RESTART: string,
  RUNNING: string,
  PAUSE: string,
  RESUME: string,
  STEP: string,
  STUCK: string
  }}
*/
SimRunner.i18n_strings;

/**
@type {SimRunner.i18n_strings}
*/
SimRunner.en = {
  TIME_STEP: 'time step',
  DISPLAY_PERIOD: 'display period',
  RESTART: 'restart',
  RUNNING: 'running',
  PAUSE: 'pause',
  RESUME: 'resume',
  STEP: 'step',
  STUCK: 'Simulation is stuck; click reset and play to continue.'
};

/**
@private
@type {SimRunner.i18n_strings}
*/
SimRunner.de_strings = {
  TIME_STEP: 'Zeitschritt',
  DISPLAY_PERIOD: 'Bilddauer',
  RESTART: 'Neustart',
  RUNNING: 'laufend',
  PAUSE: 'pausieren',
  RESUME: 'weiter',
  STEP: 'kleine Schritte',
  STUCK: 'Simulation hat sich aufgeh\u00e4ngt; dr\u00fccken Sie Neustart und Weiter um fort zu fahren.'
};

/** Set of internationalized strings.
@type {SimRunner.i18n_strings}
*/
SimRunner.i18n = goog.LOCALE === 'de' ? SimRunner.de_strings :
    SimRunner.en;

}); // goog.scope
