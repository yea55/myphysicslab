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

goog.provide('myphysicslab.lab.model.SimList');

goog.require('goog.array');
goog.require('myphysicslab.lab.model.Arc');
goog.require('myphysicslab.lab.model.ConcreteLine');
goog.require('myphysicslab.lab.model.PointMass');
goog.require('myphysicslab.lab.model.SimObject');
goog.require('myphysicslab.lab.model.Spring');
goog.require('myphysicslab.lab.util.AbstractSubject');
goog.require('myphysicslab.lab.util.GenericEvent');
goog.require('myphysicslab.lab.util.UtilityCore');

goog.scope(function() {

var lab = myphysicslab.lab;

var Arc = lab.model.Arc;
var ConcreteLine = lab.model.ConcreteLine;
var AbstractSubject = lab.util.AbstractSubject;
var GenericEvent = lab.util.GenericEvent;
var NF = lab.util.UtilityCore.NF;
var PointMass = lab.model.PointMass;
var SimObject = lab.model.SimObject;
var Spring = lab.model.Spring;
var UtilityCore = lab.util.UtilityCore;

/** The list of SimObjects that represent the current state of a
Simulation. For an ODESim the current state is dictated by its VarsList and the
SimObjects reflect that state in their positions. The SimObjects give additional
information that is not in the VarsList, such as size, shape, and mass of objects,
as well as forces like springs. The order of objects in a SimList has no significance,
it should be regarded as an unordered set.

The purpose of SimObjects and the SimList is two-fold:

1. to give the outside world a view of what is going on in the Simulation.

2. SimObjects are often used by the Simulation's internal calculations.

See {@link myphysicslab.lab.view.DisplayObject} for a discussion of how SimObjects are
made visible to the user. See {@link myphysicslab.lab.app.SimController} for information
about how SimObjects participate in user interface interactions like dragging an object.

Events Broadcast
----------------
A SimList is a Subject, so you can add one or more Observers to it. When SimObjects are
added or removed, the SimList broadcasts a GenericEvent with the name
{@link #OBJECT_ADDED} or {@link #OBJECT_REMOVED} to inform the Observers. The value
of the GenericEvent is the SimObject that was added or removed.

Similar Objects Are Not Added
-----------------------------
We avoid adding a SimObject when it has finite
{@link myphysicslab.lab.model.SimObject#getExpireTime expiration time} and is similar
to an existing SimObject as found using {@link #getSimilar}.
There is a *tolerance setting* that determines when SimObjects are similar, see {@link
#getTolerance}.

This is to prevent thousands of similar SimObjects being created which would only slow
performance without adding any significant information to the visual display. An example
of this is when we show forces in ContactSim.

* @constructor
* @final
* @struct
* @extends {myphysicslab.lab.util.AbstractSubject}
*/
myphysicslab.lab.model.SimList = function() {
  AbstractSubject.call(this, 'SIM_LIST');
  /** The SimObjectss that this SimList contains.
  * @type {!Array<!myphysicslab.lab.model.SimObject>}
  * @private
  */
  this.elements_ = [];
  /**
  * @type {number}
  * @private
  */
  this.tolerance_ = 0.1;
};
var SimList = myphysicslab.lab.model.SimList;
goog.inherits(SimList, AbstractSubject);

if (!UtilityCore.ADVANCED) {
  /** @inheritDoc */
  SimList.prototype.toString = function() {
    return this.toStringShort().slice(0, -1)
        +', tolerance_: '+NF(this.tolerance_)
        +', elements_: ['
        + goog.array.map(this.elements_, function(e, idx) {
            return idx+': '+e.toStringShort();
          })
        + ']' + SimList.superClass_.toString.call(this);
  };

  /** @inheritDoc */
  SimList.prototype.toStringShort = function() {
    return SimList.superClass_.toStringShort.call(this).slice(0, -1)
        + ', length: '+this.elements_.length+'}';
  };
};

/** @inheritDoc */
SimList.prototype.getClassName = function() {
  return 'SimList';
};

/** Name of event broadcast when a SimObject is added to the SimList.
* @type {string}
* @const
*/
SimList.OBJECT_ADDED = 'OBJECT_ADDED';

/** Name of event broadcast when a SimObject has been modified, but not added
* or removed from the SimList.
* @type {string}
* @const
*/
SimList.OBJECT_MODIFIED = 'OBJECT_MODIFIED';

/** Name of event broadcast when a SimObject is removed from the SimList.
* @type {string}
* @const
*/
SimList.OBJECT_REMOVED = 'OBJECT_REMOVED';

/** Adds the SimObject to this SimList. Notifies Observers by broadcasting
the {@link #OBJECT_ADDED} event. For SimObjects with finite
{@link myphysicslab.lab.model.SimObject#getExpireTime expiration time}, we remove
any existing similar SimObject in this SimList, as found using
{@link #getSimilar} with the default tolerance from {@link #getTolerance}.
@param {...!myphysicslab.lab.model.SimObject} simObjs the SimObjects to add
*/
SimList.prototype.add = function(simObjs) {
  for (var i=0; i<arguments.length; i++) {
    /** @type {!myphysicslab.lab.model.SimObject} */
    var element = arguments[i];
    if (!goog.isDefAndNotNull(element)) {
      throw new Error('cannot add invalid SimObject');
    }
    var expire = element.getExpireTime();
    if (isFinite(expire)) {
      var similar;
      while (similar = this.getSimilar(element)) {
        this.remove(similar);
      }
    }
    if (!goog.array.contains(this.elements_, element)) {
      this.elements_.push(element);
      this.broadcast(new GenericEvent(this, SimList.OBJECT_ADDED, element));
    }
  }
};

/** Adds the set of SimObjects to this SimList. Notifies Observers by broadcasting the
{@link #OBJECT_ADDED} event for each SimObject added.
@param {!Array<!myphysicslab.lab.model.SimObject>} objList the SimObjects to add
*/
SimList.prototype.addAll = function(objList) {
  for (var i=0, len=objList.length; i<len; i++) {
    this.add(objList[i]);
  }
};

/** Removes all SimObjects from this SimList. Notifies Observers by broadcasting the
{@link #OBJECT_REMOVED} event for each SimObject removed.
* @return {undefined}
*/
SimList.prototype.clear = function() {
  this.removeAll(this.toArray());
};

/** Returns true if the SimObject is in this SimList.
@param {!myphysicslab.lab.model.SimObject} simObj the SimObject to look for
@return {boolean} true if the SimObject is in this SimList.
*/
SimList.prototype.contains = function(simObj) {
  return goog.array.contains(this.elements_, simObj);
};

/** Returns the SimObject at the specified position in this SimList, or the first
SimObject in this SimList with the given name.
@param {number|string} arg  index number or name of SimObject. Name should be English
    or language-independent version of name.
@return {!myphysicslab.lab.model.SimObject} the SimObject at the specified position in
    this SimList, or with the given name
@throws {Error} if SimObject not found or index out of range
*/
SimList.prototype.get = function(arg) {
  if (goog.isNumber(arg)) {
    if (arg >= 0 && arg < this.elements_.length) {
      return this.elements_[arg];
    }
  } else if (goog.isString(arg)) {
    arg = UtilityCore.toName(arg);
    var e = goog.array.find(this.elements_,
      function (/** !SimObject */obj, index, array) {
        return obj.getName() == arg;
      });
    if (e != null) {
      return e;
    }
  }
  throw new Error('SimList did not find '+arg);
};

/** Returns the Arc with the given name, if found in this SimList.
@param {string} name name of Arc to find
@return {!myphysicslab.lab.model.Arc} the Arc with the given name
@throws {Error} if Arc not found
*/
SimList.prototype.getArc = function(name) {
  var obj = this.get(name);
  if (obj instanceof Arc) {
    return /** @type {!Arc} */(obj);
  } else {
    throw new Error('no Arc named '+name);
  }
};

/** Returns the ConcreteLine with the given name, if found in this SimList.
@param {string} name name of ConcreteLine to find
@return {!myphysicslab.lab.model.ConcreteLine} the ConcreteLine with the given name
@throws {Error} if ConcreteLine not found
*/
SimList.prototype.getConcreteLine = function(name) {
  var obj = this.get(name);
  if (obj instanceof ConcreteLine) {
    return /** @type {!ConcreteLine} */(obj);
  } else {
    throw new Error('no ConcreteLine named '+name);
  }
};

/** Returns the PointMass with the given name, if found in this SimList.
@param {string} name name of PointMass to find
@return {!myphysicslab.lab.model.PointMass} the PointMass with the given name
@throws {Error} if PointMass not found
*/
SimList.prototype.getPointMass = function(name) {
  var obj = this.get(name);
  if (obj instanceof PointMass) {
    return /** @type {!PointMass} */(obj);
  } else {
    throw new Error('no PointMass named '+name);
  }
};

/** Returns a similar SimObject already in this SimList, or `null` if there isn't one.
See {@link myphysicslab.lab.model.SimObject#similar} for how similarity is determined.
@param {!myphysicslab.lab.model.SimObject} simObj the SimObject to use for comparison
@param {number=} tolerance the tolerance used when testing for similarity; default is
    given by {@link #getTolerance}
@return {?myphysicslab.lab.model.SimObject} a similar looking SimObject on this
    SimList, or `null` if there isn't one
*/
SimList.prototype.getSimilar = function(simObj, tolerance) {
  var tol = (tolerance === undefined) ? this.tolerance_ : tolerance;
  return goog.array.find(this.elements_,
    function(/** @type !SimObject*/obj, index, array) {
      return obj.similar(simObj, tol);
    });
};

/** Returns the Spring with the given name, if found in this SimList.
@param {string} name name of Spring to find
@return {!myphysicslab.lab.model.Spring} the Spring with the given name
@throws {Error} if Spring not found
*/
SimList.prototype.getSpring = function(name) {
  var obj = this.get(name);
  if (obj instanceof Spring) {
    return /** @type {!Spring} */(obj);
  } else {
    throw new Error('no Spring named '+name);
  }
};

/** Returns the tolerance used for similarity testing when adding objects to this
SimList. See {@link myphysicslab.lab.model.SimObject#similar} for how similarity is
determined.
@return {number} the tolerance used for similarity testing when adding
SimObjects
*/
SimList.prototype.getTolerance = function() {
  return this.tolerance_;
};

/** Returns the index of the first occurrence of the specified SimObject in
this list, or -1 if this list does not contain the SimObject.
@param {!myphysicslab.lab.model.SimObject} simObj the SimObject to look for
@return {number} the index of the first occurrence of the specified SimObject in
    this list, or -1 if this list does not contain the SimObject
*/
SimList.prototype.indexOf = function(simObj) {
  return goog.array.indexOf(this.elements_, simObj);
};

/** Returns the number of SimObjects in this SimList.
@return {number} the number of SimObjects in this SimList.
*/
SimList.prototype.length = function() {
  return this.elements_.length;
};

/** Removes the SimObject from this SimList. Notifies Observers by broadcasting the
{@link #OBJECT_REMOVED} event.
@param {!myphysicslab.lab.model.SimObject} simObj the SimObject to remove
*/
SimList.prototype.remove = function(simObj) {
  if (goog.array.remove(this.elements_, simObj)) {
    this.broadcast(new GenericEvent(this, SimList.OBJECT_REMOVED, simObj));
  }
};

/** Removes the set of SimObjects from this SimList. Notifies Observers by broadcasting
the {@link #OBJECT_REMOVED} event for each SimObject removed.
@param {!Array<!myphysicslab.lab.model.SimObject>} objList the SimObjects to remove
*/
SimList.prototype.removeAll = function(objList) {
  for (var i=0, len=objList.length; i<len; i++) {
    this.remove(objList[i]);
  }
};

/** Removes SimObjects from this SimList whose *expiration time* is less than the given
time. Notifies Observers by broadcasting the {@link #OBJECT_REMOVED} event for each
SimObject removed. See {@link myphysicslab.lab.model.SimObject#getExpireTime}
@param {number} time the current simulation time
*/
SimList.prototype.removeTemporary = function(time) {
  for (var i = this.elements_.length-1; i >= 0; i--) {
    var simobj = this.elements_[i];
    if (simobj.getExpireTime() < time) {
      this.elements_.splice(i, 1);
      this.broadcast(new GenericEvent(this, SimList.OBJECT_REMOVED, simobj));
    }
  }
};

/** Sets the tolerance used for similarity testing when adding objects to this
SimList. See {@link myphysicslab.lab.model.SimObject#similar} for how similarity is
determined.
@param {number} tolerance the tolerance used for similarity testing when adding
    SimObjects
*/
SimList.prototype.setTolerance = function(tolerance) {
  this.tolerance_ = tolerance;
};

/** Returns an array containing all the SimObjects on this SimList.
@return {!Array<!myphysicslab.lab.model.SimObject>} an array containing all the
    SimObjects on this SimList.
*/
SimList.prototype.toArray = function() {
  return goog.array.clone(this.elements_);
};

}); // goog.scope
