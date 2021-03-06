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

goog.provide('myphysicslab.sims.roller.RollerFlightApp');

goog.require('myphysicslab.lab.controls.NumericControl');
goog.require('myphysicslab.lab.model.CollisionAdvance');
goog.require('myphysicslab.lab.model.NumericalPath');
goog.require('myphysicslab.lab.model.PointMass');
goog.require('myphysicslab.lab.model.Spring');
goog.require('myphysicslab.lab.util.DoubleRect');
goog.require('myphysicslab.lab.util.GenericObserver');
goog.require('myphysicslab.lab.util.ParameterNumber');
goog.require('myphysicslab.lab.util.UtilityCore');
goog.require('myphysicslab.lab.util.Vector');
goog.require('myphysicslab.lab.view.DisplayPath');
goog.require('myphysicslab.lab.view.DisplayShape');
goog.require('myphysicslab.lab.view.DisplaySpring');
goog.require('myphysicslab.lab.view.DrawingStyle');
goog.require('myphysicslab.lab.view.LabView');
goog.require('myphysicslab.sims.layout.AbstractApp');
goog.require('myphysicslab.sims.layout.CommonControls');
goog.require('myphysicslab.sims.layout.TabLayout');
goog.require('myphysicslab.sims.roller.HumpPath');
goog.require('myphysicslab.sims.roller.RollerFlightSim');

goog.scope(function() {

var lab = myphysicslab.lab;
var sims = myphysicslab.sims;

var AbstractApp = sims.layout.AbstractApp;
var CollisionAdvance = lab.model.CollisionAdvance;
var CommonControls = sims.layout.CommonControls;
var DisplayPath = lab.view.DisplayPath;
var DisplayShape = lab.view.DisplayShape;
var DisplaySpring = lab.view.DisplaySpring;
var DoubleRect = lab.util.DoubleRect;
var DrawingStyle = myphysicslab.lab.view.DrawingStyle;
var GenericObserver = lab.util.GenericObserver;
var HumpPath = sims.roller.HumpPath;
var LabView = lab.view.LabView;
var NumericalPath = lab.model.NumericalPath;
var NumericControl = lab.controls.NumericControl;
var ParameterNumber = lab.util.ParameterNumber;
var PointMass = lab.model.PointMass;
var RollerFlightSim = sims.roller.RollerFlightSim;
var Spring = lab.model.Spring;
var TabLayout = sims.layout.TabLayout;
var UtilityCore = lab.util.UtilityCore;
var Vector = lab.util.Vector;

/** Creates the RollerFlightSim simulation

* @param {!TabLayout.elementIds} elem_ids specifies the names of the HTML
*    elementId's to look for in the HTML document; these elements are where the user
*    interface of the simulation is created.
* @constructor
* @final
* @extends {AbstractApp}
* @struct
* @export
*/
myphysicslab.sims.roller.RollerFlightApp = function(elem_ids) {
  UtilityCore.setErrorHandler();
  /** @type {!lab.model.NumericalPath} */
  this.path = new NumericalPath(new HumpPath());
  var simRect = new DoubleRect(-6, -6, 6, 6);
  var sim = new RollerFlightSim(this.path);
  var advance = new CollisionAdvance(sim);
  AbstractApp.call(this, elem_ids, simRect, sim, advance, /*eventHandler=*/sim,
      /*energySystem=*/sim);
  this.layout.simCanvas.setBackground('black');
  this.layout.simCanvas.setAlpha(CommonControls.SHORT_TRAILS);

  /** @type {!lab.view.DisplayShape} */
  this.ball1 = new DisplayShape(this.simList.getPointMass('ball1'))
      .setFillStyle('blue');
  this.displayList.add(this.ball1);

  /** @type {!lab.view.DisplayShape} */
  this.anchor = new DisplayShape(this.simList.getPointMass('anchor'))
      .setFillStyle('red');
  this.displayList.add(this.anchor);

  /** @type {!lab.view.DisplaySpring} */
  this.spring = new DisplaySpring(this.simList.getSpring('spring'))
      .setWidth(0.2).setColorCompressed('red')
      .setColorExpanded('#6f6'); /* brighter green */
  this.displayList.add(this.spring);

  /** @type {!lab.view.DisplayPath} */
  this.displayPath = new DisplayPath();
  this.displayPath.setScreenRect(this.simView.getScreenRect());
  this.displayPath.addPath(this.path);
  this.displayList.add(this.displayPath);

  // modify size of display to fit this path
  this.simView.setSimRect(this.path.getBoundsWorld().scale(1.1));

  // change color of ball depending on whether on track or in free flight
  var trackVar = sim.getVarsList().getVariable(6);
  new GenericObserver(sim.getVarsList(), goog.bind(function(evt) {
    if (evt == trackVar) {
      this.ball1.setFillStyle(trackVar.getValue() > 0 ? 'blue' : 'red');
    }
  }, this), 'change color of ball when in free flight');

  // adjust path display when SimView size changes
  new GenericObserver(this.simView, goog.bind(function(evt) {
    if (evt.nameEquals(LabView.SCREEN_RECT_CHANGED)) {
      this.displayPath.setScreenRect(this.simView.getScreenRect());
    }
  }, this), 'resize displayPath when screen rect changes');

  this.addPlaybackControls();
  /** @type {!lab.util.ParameterNumber} */
  var pn;
  pn = sim.getParameterNumber(RollerFlightSim.en.ELASTICITY);
  this.addControl(new NumericControl(pn));
  pn = sim.getParameterNumber(RollerFlightSim.en.STICKINESS);
  this.addControl(new NumericControl(pn));
  pn = sim.getParameterNumber(RollerFlightSim.en.GRAVITY);
  this.addControl(new NumericControl(pn));
  pn = sim.getParameterNumber(RollerFlightSim.en.MASS);
  this.addControl(new NumericControl(pn));
  pn = sim.getParameterNumber(RollerFlightSim.en.DAMPING);
  this.addControl(new NumericControl(pn));
  pn = sim.getParameterNumber(RollerFlightSim.en.SPRING_STIFFNESS);
  this.addControl(new NumericControl(pn));
  pn = sim.getParameterNumber(RollerFlightSim.en.SPRING_LENGTH);
  this.addControl(new NumericControl(pn));

  this.addStandardControls();

  this.graph.line.setXVariable(0);
  this.graph.line.setYVariable(1);
  this.timeGraph.line1.setYVariable(0);
  this.timeGraph.line2.setYVariable(1);

  this.makeEasyScript();
  this.addURLScriptButton();
};
var RollerFlightApp = myphysicslab.sims.roller.RollerFlightApp;
goog.inherits(RollerFlightApp, AbstractApp);

if (!UtilityCore.ADVANCED) {
  /** @inheritDoc */
  RollerFlightApp.prototype.toString = function() {
    return this.toStringShort().slice(0, -1)
        +', ball1: '+this.ball1.toStringShort()
        +', anchor: '+this.anchor.toStringShort()
        +', spring: '+this.spring.toStringShort()
        +', path: '+this.path.toStringShort()
        +', displayPath: '+this.displayPath.toStringShort()
        + RollerFlightApp.superClass_.toString.call(this);
  };
};

/** @inheritDoc */
RollerFlightApp.prototype.getClassName = function() {
  return 'RollerFlightApp';
};

/** @inheritDoc */
RollerFlightApp.prototype.defineNames = function(myName) {
  RollerFlightApp.superClass_.defineNames.call(this, myName);
  this.terminal.addRegex('ball1|anchor|spring|path|displayPath',
      myName);
};

}); // goog.scope
