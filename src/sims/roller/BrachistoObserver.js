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

goog.provide('myphysicslab.sims.roller.BrachistoObserver');

goog.require('myphysicslab.lab.model.NumericalPath');
goog.require('myphysicslab.lab.model.PointMass');
goog.require('myphysicslab.lab.model.SimList');
goog.require('myphysicslab.lab.model.SimObject');
goog.require('myphysicslab.lab.util.GenericEvent');
goog.require('myphysicslab.lab.util.Observer');
goog.require('myphysicslab.lab.util.Subject');
goog.require('myphysicslab.lab.util.UtilityCore');
goog.require('myphysicslab.lab.util.Vector');
goog.require('myphysicslab.lab.view.DisplayList');
goog.require('myphysicslab.lab.view.DisplayPath');
goog.require('myphysicslab.lab.view.DisplayShape');
goog.require('myphysicslab.lab.view.DisplayText');
goog.require('myphysicslab.lab.view.DrawingStyle');
goog.require('myphysicslab.lab.view.LabView');
goog.require('myphysicslab.lab.view.SimView');
goog.require('myphysicslab.sims.roller.BrachistoSim');

goog.scope(function() {

var BrachistoSim = myphysicslab.sims.roller.BrachistoSim;
var DisplayList = myphysicslab.lab.view.DisplayList;
var DisplayPath = myphysicslab.lab.view.DisplayPath;
var DisplayShape = myphysicslab.lab.view.DisplayShape;
var DisplayText = myphysicslab.lab.view.DisplayText;
var DrawingStyle = myphysicslab.lab.view.DrawingStyle;
var GenericEvent = myphysicslab.lab.util.GenericEvent;
var LabView = myphysicslab.lab.view.LabView;
var NumericalPath = myphysicslab.lab.model.NumericalPath;
var Observer = myphysicslab.lab.util.Observer;
var PointMass = myphysicslab.lab.model.PointMass;
var SimList = myphysicslab.lab.model.SimList;
var SimObject = myphysicslab.lab.model.SimObject;
var SimView = myphysicslab.lab.view.SimView;
var Subject = myphysicslab.lab.util.Subject;
var UtilityCore = myphysicslab.lab.util.UtilityCore;
var Vector = myphysicslab.lab.util.Vector;

/** Observes the SimList of the BrachistoSim simulation, adding or removing
DisplayObjects to represent the simulation. BrachistoObserver also listens for the
PATH_CHOSEN event from BrachistoSim and modifies the DisplayText message accordingly, to
show the 'click a path' message or the 'you chose' message.

Note that this will add DisplayObject for every object currently on the simList.

@param {!myphysicslab.sims.roller.BrachistoSim} sim
@param {!myphysicslab.lab.model.SimList} simList
@param {!myphysicslab.lab.view.SimView} simView
@param {!myphysicslab.lab.view.SimView} statusView
@implements {myphysicslab.lab.util.Observer}
@constructor
@final
@struct
*/
myphysicslab.sims.roller.BrachistoObserver = function(sim, simList, simView, statusView) {
  /**
  * @type {!myphysicslab.sims.roller.BrachistoSim}
  * @private
  */
  this.sim_ = sim;
  /**
  * @type {!myphysicslab.lab.view.SimView}
  * @private
  */
  this.simView_ = simView;
  /**
  * @type {!myphysicslab.lab.view.DisplayList}
  * @private
  */
  this.displayList_ = simView.getDisplayList();
  /**
  * @type {!myphysicslab.lab.view.SimView}
  * @private
  */
  this.statusView_ = statusView;
  /**
  * @type {!myphysicslab.lab.view.DisplayPath}
  * @private
  */
  this.displayPath_ = new DisplayPath();
  this.displayPath_.setScreenRect(simView.getScreenRect());
  this.displayPath_.setZIndex(-10);
  this.displayList_.add(this.displayPath_);
  /**
  @type {!myphysicslab.lab.model.SimList}
  @private
  */
  this.simList_ = simList;
  // add display objects for all bodies currently in the simList
  this.addBodies(simList.toArray());
  /**
  * @type {?myphysicslab.lab.view.DisplayText}
  * @private
  */
  this.message_ = new DisplayText(BrachistoObserver.i18n.QUESTION);
  this.message_.setFillStyle('gray');
  this.message_.setDragable(false);
  this.message_.setPosition(this.getTextPosition());
  this.statusView_.getDisplayList().add(this.message_);
  simView.addObserver(this);
  simList.addObserver(this);
  sim.addObserver(this);
};
var BrachistoObserver = myphysicslab.sims.roller.BrachistoObserver;

if (!UtilityCore.ADVANCED) {
  /** @inheritDoc */
  BrachistoObserver.prototype.toString = function() {
    return 'BrachistoObserver{'
      +'sim_: '+this.sim_.toStringShort()
      +', simList_: '+this.simList_.toStringShort()
      +', simView_: '+this.simView_.toStringShort()
      +', displayList_: '+this.displayList_.toStringShort()
      +', statusView_: '+this.statusView_.toStringShort()
      +', displayPath_: '+this.displayPath_.toStringShort()
      +'}';
  };

  /** @inheritDoc */
  BrachistoObserver.prototype.toStringShort = function() {
    return 'BrachistoObserver{}';
  };
};

/** Creates DisplayObjects for the SimObjects, and add to SimView.
* @param {!Array<!SimObject>} bodies
*/
BrachistoObserver.prototype.addBodies = function(bodies) {
  goog.array.forEach(bodies, goog.bind(this.addBody, this));
};

/** Creates DisplayObject for the SimObject, and adds DisplayObject to SimView.
* @param {!SimObject} obj
*/
BrachistoObserver.prototype.addBody = function(obj) {
  var dobj = this.displayList_.find(obj);
  if (dobj != null) {
    // if we already have a DisplayObject for this, don't add a new one.
    return;
  }
  if (obj instanceof NumericalPath) {
    var np = /** @type {!NumericalPath} */(obj);
    this.displayPath_.addPath(np, DrawingStyle.lineStyle('gray', /*lineWidth=*/2));
  } else if (obj instanceof PointMass) {
    var pm = /** @type {!PointMass} */(obj);
    var dp = new DisplayShape(pm);
    dp.setDragable(false);
    if (pm.getName().match(/BALL_SELECTED/)) {
      dp.setFillStyle('red');
      this.displayList_.add(dp);
    } else if (pm.getName().match(/BALL/)) {
      dp.setFillStyle('blue');
      this.displayList_.add(dp);
    } else if (pm.getName().match(/(START|END)/)) {
      dp.setFillStyle('');
      dp.setStrokeStyle('gray');
      dp.setThickness(1);
      dp.setZIndex(-1);
      this.displayList_.add(dp);
    }
  } else {
    throw new Error('BrachistoObserver unknown object '+obj);
  }
};

/** Calculate position to display the text message.
* @return {!myphysicslab.lab.util.Vector}
* @private
*/
BrachistoObserver.prototype.getTextPosition = function() {
  var sr = this.statusView_.getScreenRect();
  var r = this.statusView_.getCoordMap().screenToSimRect(sr);
  return new Vector(r.getLeft() + 0.15*r.getWidth(), r.getTop() - 0.1*r.getHeight());
};

/** @inheritDoc */
BrachistoObserver.prototype.observe =  function(event) {
  //console.log('BrachistoObserver event='+event);
  if (event.getSubject() == this.sim_) {
    if (event.nameEquals(BrachistoSim.PATH_CHOSEN)) {
      // text object shows the question or the choice
      var msg;
      var choice = this.sim_.getPathChoice();
      if (choice >= 0) {
        msg = BrachistoObserver.i18n.YOU_PICKED;
        msg += ' ' + this.sim_.getPaths()[choice].getName();
        msg += ' ' + BrachistoObserver.i18n.PATH + '.';
      } else {
        msg = BrachistoObserver.i18n.QUESTION;
      }
      this.message_.setText(msg);
    }
  } else if (event.getSubject() == this.simView_) {
    /* adjust path display size when SimView size changes */
    if (event.nameEquals(LabView.SCREEN_RECT_CHANGED)) {
      this.displayPath_.setScreenRect(this.simView_.getScreenRect());
    }
  } else if (event.getSubject() == this.simList_) {
    var obj = /** @type {!SimObject} */ (event.getValue());
    if (event.nameEquals(SimList.OBJECT_ADDED)) {
      this.addBody(obj);
    } else if (event.nameEquals(SimList.OBJECT_REMOVED)) {
      if (obj instanceof NumericalPath) {
        var np = /** @type {!NumericalPath} */(obj);
        this.displayPath_.removePath(np);
      } else if (obj instanceof PointMass) {
        var so = /** @type {!SimObject} */(obj);
        var dispObj = this.displayList_.find(so);
        if (dispObj != null) {
          this.displayList_.remove(dispObj);
        }
      }
    }
  }
};

/** Set of internationalized strings.
@typedef {{
  PATH: string,
  QUESTION: string,
  YOU_PICKED: string
  }}
*/
BrachistoObserver.i18n_strings;

/**
@type {BrachistoObserver.i18n_strings}
*/
BrachistoObserver.en = {
  PATH: 'path',
  QUESTION: 'Which path is fastest to slide down?  Click a path to begin.',
  YOU_PICKED: 'You picked the'
};

/**
@private
@type {BrachistoObserver.i18n_strings}
*/
BrachistoObserver.de_strings = {
  PATH: 'Pfad gew\u00e4hlt',
  QUESTION: 'Welcher Pfad ist am schnellsten zum abrutschen?  W\u00e4hlen Sie ein Pfad um zu beginnen.',
  YOU_PICKED: 'Sie haben den'
};

/** Set of internationalized strings.
@type {BrachistoObserver.i18n_strings}
*/
BrachistoObserver.i18n = goog.LOCALE === 'de' ? BrachistoObserver.de_strings :
    BrachistoObserver.en;

});  // goog.scope
