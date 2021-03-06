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
goog.provide('myphysicslab.lab.app.RigidBodyEventHandler');

goog.require('goog.array');
goog.require('goog.asserts');
goog.require('goog.events.KeyCodes');
goog.require('myphysicslab.lab.engine2D.RigidBody');
goog.require('myphysicslab.lab.engine2D.RigidBodySim');
goog.require('myphysicslab.lab.engine2D.Shapes');
goog.require('myphysicslab.lab.engine2D.ThrusterSet');
goog.require('myphysicslab.lab.app.EventHandler');
goog.require('myphysicslab.lab.model.PointMass');
goog.require('myphysicslab.lab.model.Spring');
goog.require('myphysicslab.lab.model.SimObject');
goog.require('myphysicslab.lab.util.Clock');
goog.require('myphysicslab.lab.util.UtilityCore');
goog.require('myphysicslab.lab.util.Vector');

goog.scope(function() {

var EventHandler = myphysicslab.lab.app.EventHandler;
var KeyCodes = goog.events.KeyCodes;
var NF = myphysicslab.lab.util.UtilityCore.NF;
var NF5 = myphysicslab.lab.util.UtilityCore.NF5;
var PointMass = myphysicslab.lab.model.PointMass;
var Spring = myphysicslab.lab.model.Spring;
var RigidBody = myphysicslab.lab.engine2D.RigidBody;
var RigidBodySim = myphysicslab.lab.engine2D.RigidBodySim;
var Shapes = myphysicslab.lab.engine2D.Shapes;
var SimObject = myphysicslab.lab.model.SimObject;
var ThrusterSet = myphysicslab.lab.engine2D.ThrusterSet;
var UtilityCore = myphysicslab.lab.util.UtilityCore;
var Vector = myphysicslab.lab.util.Vector;

/** User interface controller for RigidBodySim, provides mouse dragging of nearest
moveable RigidBody, and keyboard thrust controls for one or two selected RigidBodys.

Mouse Drag
----------
When the Clock is running, mouse dragging is accomplished by connecting a spring between
the RigidBody and the mouse position. The spring has zero rest length. The spring
stiffness can be set via {@link #setDragStiffness}.

When the Clock is not running, mouse dragging will move the RigidBody. Holding down the
alt, meta, or control key will rotate the RigidBody when moving the mouse.

Thrusters
---------
One or two RigidBodys can be specified to have keyboard activated thruster controls with
{@link #setThrusters}. You can specify a {@link myphysicslab.lab.engine2D.ThrusterSet}
of thrust forces for each RigidBody. The keyboard commands to fire thrusters are:

+ Right hand controls: keys J, K, L, I and arrow keys.
+ Left hand controls: keys S, D, F, E.

Some of these key commands will fire pairs of 'side ways' thrust controls. Holding shift
key with those changes the pair of thrusters to give a rotation effect.


@todo extract the stuff about thrusters into a subclass or decorating class, so that
the mouse drag stuff could be reused separately.

* @param {!myphysicslab.lab.engine2D.RigidBodySim} sim the simulation to handle events
    for
* @param {!myphysicslab.lab.util.Clock} clock the clock that determines whether the
    simulation is running
* @constructor
* @final
* @struct
* @implements {myphysicslab.lab.app.EventHandler }
*/
myphysicslab.lab.app.RigidBodyEventHandler = function(sim, clock) {
  /**
  * @type {!myphysicslab.lab.engine2D.RigidBodySim}
  * @private
  */
  this.sim_ = sim;
  /**
  * @type {!myphysicslab.lab.util.Clock}
  * @private
  */
  this.clock_ = clock;
  /**
  * @type {?myphysicslab.lab.engine2D.ThrusterSet}
  * @private
  */
  this.thrustRight_ = null;
  /**
  * @type {?myphysicslab.lab.engine2D.ThrusterSet}
  * @private
  */
  this.thrustLeft_ = null;
  /**
  * @type {number}
  * @private
  */
  this.dragStiffness_ = 3.0;
  /**
  * @type {?myphysicslab.lab.model.Spring }
  * @private
  */
  this.dragSpring_ = null;
  /**
  * @type {!myphysicslab.lab.model.PointMass}
  * @private
  */
  this.mousePoint_ = PointMass.makeCircle(1, 'mouse position')
      .setMass(UtilityCore.POSITIVE_INFINITY);
  /**
  * @type {number}
  * @private
  */
  this.dragObj_ = -1;
  /**  whether alt, meta or control key is down
  * @type {boolean}
  * @private
  */
  this.optionKey_ = false;
  /**  for rotating a body
  * @type {number}
  * @private
  */
  this.startDragAngle_ = 0;
  /**  for rotating a body
  * @type {number}
  * @private
  */
  this.startBodyAngle_ = 0;
  /**
  * Remember whether shift key was down when these keys (left, right, S, F)
  * are first pressed, so that we use the same value for shift key when
  * the key is released.  (Fixes the 'stuck thruster' problem).
  * @type {boolean}
  * @private
  */
  this.shiftLeft_ = false;
  /**
  * @type {boolean}
  * @private
  */
  this.shiftRight_ = false;
  /**
  * @type {boolean}
  * @private
  */
  this.shiftS_ = false;
  /**
  * @type {boolean}
  * @private
  */
  this.shiftF_ = false;
};

var RigidBodyEventHandler = myphysicslab.lab.app.RigidBodyEventHandler;

if (!UtilityCore.ADVANCED) {
  /** @inheritDoc */
  RigidBodyEventHandler.prototype.toString = function() {
    return this.toStringShort().slice(0, -1)
        +', clock_: '+this.clock_.toStringShort()
        +', thrustRight_: '+this.thrustRight_
        +', thrustLeft_: '+this.thrustLeft_
        +', dragStiffness_: '+NF(this.dragStiffness_)
        +'}';
  };

  /** @inheritDoc */
  RigidBodyEventHandler.prototype.toStringShort = function() {
    return 'RigidBodyEventHandler{sim: '+this.sim_.toStringShort()+'}';
  };
};

/** Set the given ThrusterSet to be activated by keyboard thrust controls.
Right hand controls: keys J, K, L, I and arrow keys.
Left hand controls: keys S, D, F, E.
@param {?myphysicslab.lab.engine2D.ThrusterSet} thrusters the ThrusterSet to be
    activated by keyboard commands, or null to turn off this set of thruster controls
@param {string} side 'right' sets right hand controls, 'left' sets left hand controls
*/
RigidBodyEventHandler.prototype.setThrusters = function(thrusters, side) {
  if (side == 'right') {
    this.thrustRight_ = thrusters;
  } else if (side == 'left') {
    this.thrustLeft_ = thrusters;
  } else {
    throw new Error('unknown side '+side);
  }
};

/** @inheritDoc */
RigidBodyEventHandler.prototype.startDrag = function(simObject, location, offset,
    dragBody, mouseEvent) {
  this.optionKey_ = mouseEvent.altKey || mouseEvent.metaKey || mouseEvent.ctrlKey;
  this.resetDrag();
  var numBods = this.sim_.getBodies().length;
  for (var i=0; i<numBods; i++) {
    if (simObject === this.sim_.getBody(i))
      this.dragObj_ = i;
  }
  if (this.dragObj_ > -1) {
    var body = this.sim_.getBody(this.dragObj_);
    if (!this.clock_.isRunning()) {
      if (this.optionKey_) {
        // record starting angles
        this.startBodyAngle_ = body.getAngle();
        this.startDragAngle_ = Math.atan2(offset.getY(), offset.getX());
      }
    } else if (dragBody != null) {
      this.dragSpring_ = new Spring(RigidBodyEventHandler.en.DRAG,
          /*body1=*/body, /*attach1_body=*/dragBody,
          /*body2=*/this.mousePoint_, /*attach2_body=*/Vector.ORIGIN,
          /*restLength=*/0, /*stiffness=*/this.dragStiffness_);
      this.mouseDrag(simObject, location, offset, mouseEvent);
      this.sim_.addForceLaw(this.dragSpring_);
      this.sim_.getSimList().add(this.dragSpring_);
    }
  }
  return this.dragObj_ > -1;
};

/** @inheritDoc */
RigidBodyEventHandler.prototype.mouseDrag = function(simObject, location, offset,
    mouseEvent) {
  if (!this.clock_.isRunning() && this.dragObj_ > -1) {
    var body = this.sim_.getBody(this.dragObj_);
    if (this.optionKey_) {
      // rotate the body around body's CM
      var angle = Math.atan2(location.getY() - body.getPosition().getY(),
          location.getX() - body.getPosition().getX());
      body.setAngle(this.startBodyAngle_ + angle - this.startDragAngle_);
    } else {
      // when paused, move the body with the mouse.
      body.setPosition(location.subtract(offset));
    }
    // update the simulation VarsList to match the new body position
    this.sim_.initializeFromBody(body);
  } else {
    this.mousePoint_.setPosition(location);
  }
};

/** @inheritDoc */
RigidBodyEventHandler.prototype.finishDrag = function(simObject, location, offset) {
  if (1 == 0) {
    // demonstration of giving a onMouseUp action to a RigidBody.
    // Clicking on the body named 'click' causes a ball to be created.
    if (simObject != null && simObject.nameEquals(RigidBodyEventHandler.en.CLICK)) {
      var b = Shapes.makeBlock(0.2, 0.2, RigidBodyEventHandler.en.CLICK,
          RigidBodyEventHandler.i18n.CLICK);
      b.setPosition(new Vector(-2,  2));
      b.setVelocity(new Vector(10.0,  1.0),  0.0);
      this.sim_.addBody(b);
    }
  }
  this.resetDrag();
};

/** Delete the spring and forget the object being dragged.
@return {undefined}
@private
*/
RigidBodyEventHandler.prototype.resetDrag = function() {
  var spring = this.dragSpring_;
  if (spring != null) {
    this.sim_.removeForceLaw(spring);
    this.sim_.getSimList().remove(spring);
    this.dragSpring_ = null;
  }
  this.dragObj_ = -1;
};

/** @inheritDoc */
RigidBodyEventHandler.prototype.handleKeyEvent = function(keyCode, pressed, keyEvent) {
  //console.log('RBEH.handleKeyEvent keyCode:'+keyCode+'  pressed: '+pressed
  //  +' event:'+UtilityCore.propertiesOf(keyEvent, true));
  var thrustRight = this.thrustRight_;
  var thrustLeft = this.thrustLeft_;
  if (keyEvent.ctrlKey || keyEvent.metaKey || keyEvent.altKey)
    return;
  switch (keyCode) {
    case KeyCodes.LEFT:
    case KeyCodes.J:
      if (thrustRight != null) {
        if (pressed)
          this.shiftLeft_ = keyEvent.shiftKey;  // remember shift state for release
        thrustRight.setActive(1, pressed);
        thrustRight.setActive(this.shiftLeft_ ? 4 : 5, pressed);
        keyEvent.preventDefault();
      }
      break;
    case KeyCodes.RIGHT:
    case KeyCodes.L:
      if (thrustRight != null) {
        if (pressed)
          this.shiftRight_ = keyEvent.shiftKey;  // remember shift state for release
        thrustRight.setActive(0, pressed);
        thrustRight.setActive(this.shiftRight_ ? 5 : 4, pressed);
        keyEvent.preventDefault();
      }
      break;
    case KeyCodes.UP:
    case KeyCodes.I:
      if (thrustRight != null) {
        thrustRight.setActive(3, pressed);
        // don't let the keyEvent bubble up to browser window (arrow causes scrolling)
        keyEvent.preventDefault();
      }
      break;
    case KeyCodes.DOWN:
    case KeyCodes.K:
      if (thrustRight != null) {
        thrustRight.setActive(2, pressed);
        // don't let the keyEvent bubble up to browser window (arrow causes scrolling)
        keyEvent.preventDefault();
      }
      break;
    case KeyCodes.S:
      if (thrustLeft != null) {
        if (pressed)
          this.shiftS_ = keyEvent.shiftKey;  // remember shift state for release
        thrustLeft.setActive(1, pressed);
        thrustLeft.setActive(this.shiftS_ ? 4 : 5, pressed);
        keyEvent.preventDefault();
      }
      break;
    case KeyCodes.F:
      if (thrustLeft != null) {
        if (pressed)
          this.shiftF_ = keyEvent.shiftKey;  // remember shift state for release
        thrustLeft.setActive(0, pressed);
        thrustLeft.setActive(this.shiftF_ ? 5 : 4, pressed);
        keyEvent.preventDefault();
      }
      break;
    case KeyCodes.E:
      if (thrustLeft != null) {
        thrustLeft.setActive(3, pressed);
        keyEvent.preventDefault();
      }
      break;
    case KeyCodes.D:
    case KeyCodes.C:
      if (thrustLeft != null) {
        thrustLeft.setActive(2, pressed);
        keyEvent.preventDefault();
      }
      break;
    default:
      break;
  }
};

/** Returns stiffness of the drag spring
@return {number} stiffness of the drag spring
*/
RigidBodyEventHandler.prototype.getDragStiffness = function() {
  return this.dragStiffness_;
};

/** Sets stiffness of the drag spring
@param {number} stiffness of the drag spring
*/
RigidBodyEventHandler.prototype.setDragStiffness = function(stiffness) {
  this.dragStiffness_ = stiffness;
};

/** Set of internationalized strings.
@typedef {{
  CLICK: string,
  DRAG: string
  }}
*/
RigidBodyEventHandler.i18n_strings;

/**
@type {RigidBodyEventHandler.i18n_strings}
*/
RigidBodyEventHandler.en = {
  CLICK: 'click',
  DRAG: 'drag'
};

/**
@private
@type {RigidBodyEventHandler.i18n_strings}
*/
RigidBodyEventHandler.de_strings = {
  CLICK: 'klicken',
  DRAG: 'ziehen'
};

/** Set of internationalized strings.
@type {RigidBodyEventHandler.i18n_strings}
*/
RigidBodyEventHandler.i18n = goog.LOCALE === 'de' ? RigidBodyEventHandler.de_strings :
    RigidBodyEventHandler.en;

}); // goog.scope
