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

goog.provide('myphysicslab.lab.engine2D.AbstractEdge');

goog.require('myphysicslab.lab.engine2D.Edge');
goog.require('myphysicslab.lab.engine2D.Vertex');
goog.require('myphysicslab.lab.engine2D.UtilEngine');
goog.require('myphysicslab.lab.util.UtilityCore');
goog.require('myphysicslab.lab.util.Vector');

goog.scope(function() {

var NF5 = myphysicslab.lab.util.UtilityCore.NF5;
var UtilEngine = myphysicslab.lab.engine2D.UtilEngine;
var UtilityCore = myphysicslab.lab.util.UtilityCore;
var Vector = myphysicslab.lab.util.Vector;

/** Abstract base class for {@link myphysicslab.lab.engine2D.Edge}.

@todo  rename v1, v2 to be vertex1, vertex2
@todo  probably this should be an interface, not an abstract class???
@todo  distanceToLine:  why not take the distance to end point of the edge
        when the point is beyond the edge?

@todo  An Edge doesn't really need to know the RigidBody it is part of.
        There are 3 usages of body:
        1)  for coordinate transformation (bodyToWorld etc.).  This could be provided
            via an interface that defines those methods.
        2)  during construction, to add the Edge and its Vertexes to the Body
        3)  for creating a Collision or Contact.
        Number (1) can be provided via an interface that defines those methods.
        Numbers (2) and (3) could be deferred to / handled by the RigidBody itself.
        So: we could make Edge know far less about RigidBody, which would
        be a good thing in terms of object-oriented design principles.

* @param {!myphysicslab.lab.engine2D.Polygon} body the Polygon this Edge belongs to
* @param {!myphysicslab.lab.engine2D.Vertex} vertex1 the previous vertex, in body
  coords; matches the next (second) vertex of the previous edge
* @param {!myphysicslab.lab.engine2D.Vertex} vertex2 the next vertex, in body coords
* @constructor
* @abstract
* @struct
* @implements {myphysicslab.lab.engine2D.Edge}
*/
myphysicslab.lab.engine2D.AbstractEdge = function(body, vertex1, vertex2) {
  /** the previous vertex, in body coords; matches the next (second) vertex of the
  previous edge
  * @type {!myphysicslab.lab.engine2D.Vertex}
  * @protected
  */
  this.v1_ = vertex1;
  /** the next vertex, in body coords
  * @type {!myphysicslab.lab.engine2D.Vertex}
  * @protected
  */
  this.v2_ = vertex2;
  /** the 'center' of this edge, an arbitrary point selected to minimize the centroid
  * radius of this edge
  * @type {!myphysicslab.lab.util.Vector}
  * @protected
  */
  this.centroid_body_ = this.v1_.locBody().add(this.v2_.locBody()).multiply(0.5);
  /** the maximum distance from centroid to any point on this edge
  * @type {number}
  * @protected
  */
  this.centroidRadius_ = UtilityCore.NaN;
  /** the Polygon that this edge is a part of
  * @type {!myphysicslab.lab.engine2D.Polygon}
  * @protected
  */
  this.body_ = body;
  /** index of this edge in the body's list of edges
  * @type {number}
  * @protected
  */
  this.index_ = -1;
};

var AbstractEdge = myphysicslab.lab.engine2D.AbstractEdge;

/**
@const
@type {number}
@protected
*/
AbstractEdge.TINY_POSITIVE = 1E-10;

if (!UtilityCore.ADVANCED) {
  AbstractEdge.prototype.toString = function() {
    return this.toStringShort().slice(0, -1)
        +', v1_: '+this.v1_.toStringShort()
        +', v2_: '+this.v2_.toStringShort()
        +', centroid_body_: '+this.centroid_body_
        +', centroidRadius_: '+NF5(this.centroidRadius_)
  };

  AbstractEdge.prototype.toStringShort = function() {
    return this.getClassName()+'{body_.name: "'+this.body_.getName()
        +'", index_: '+this.getIndex()+'}';
  };
};

/** @inheritDoc @abstract */
AbstractEdge.prototype.addPath = function(context) {};

/** @inheritDoc @abstract */
AbstractEdge.prototype.chordError = function() {};

/** @inheritDoc @abstract */
AbstractEdge.prototype.distanceToEdge = function(edge) {};

/** @inheritDoc @abstract */
AbstractEdge.prototype.distanceToLine = function(p_body) {};

/** @inheritDoc @abstract */
AbstractEdge.prototype.distanceToPoint = function(p_body) {};

/** @inheritDoc @abstract */
AbstractEdge.prototype.findVertexContact = function(v, p_body, distTol) {};

/** @inheritDoc */
AbstractEdge.prototype.getBody = function() {
  return this.body_;
};

/** @inheritDoc @abstract */
AbstractEdge.prototype.getBottomBody = function() {};

/** @inheritDoc @abstract */
AbstractEdge.prototype.getCenterOfCurvature = function(p_body) {};

/** @inheritDoc */
AbstractEdge.prototype.getCentroidBody = function() {
  return this.centroid_body_;
};

/** @inheritDoc */
AbstractEdge.prototype.getCentroidRadius = function() {
  if (isNaN(this.centroidRadius_)) {
    // increase the max distance to account for the following problem:
    // Suppose two blocks, each same sized squares collide straight on;
    // The max radius of an edge is a circle about center of that edge;
    // but the other block will penetrate and both Vertexes will be just
    // outside of that edge's max radius circle.
    this.centroidRadius_ = 1.25 * this.maxDistanceTo(this.centroid_body_);
  }
  return this.centroidRadius_;
};

/** @inheritDoc */
AbstractEdge.prototype.getCentroidWorld = function() {
  var v = this.body_.getEdgeCentroidWorld(this.getIndex());
  if (v == null) {
    v = this.body_.bodyToWorld(this.centroid_body_);
    // store the centroid in world coords in an array on the body
    this.body_.setEdgeCentroidWorld(this.getIndex(), v);
  }
  return v;
};

/** Returns name of class of this object.
* @return {string} name of class of this object.
* @abstract
*/
AbstractEdge.prototype.getClassName = function() {};

/** @inheritDoc @abstract */
AbstractEdge.prototype.getCurvature = function(p_body) {};

/** @inheritDoc */
AbstractEdge.prototype.getDecoratedVertexes = function() {
  return [];
};

/** @inheritDoc */
AbstractEdge.prototype.getIndex = function() {
  if (this.index_ == -1) {
    this.index_ = goog.array.indexOf(this.body_.getEdges_(), this);
    if (this.index_ == -1) {
      throw new Error();
    }
  }
  return this.index_;
};

/** @inheritDoc @abstract */
AbstractEdge.prototype.getLeftBody = function() {};

/** @inheritDoc @abstract */
AbstractEdge.prototype.getNormalBody = function(p_body) {};

/** @inheritDoc @abstract */
AbstractEdge.prototype.getPointOnEdge = function(p_body) {};

/** @inheritDoc @abstract */
AbstractEdge.prototype.getRightBody = function() {};

/** @inheritDoc @abstract */
AbstractEdge.prototype.getTopBody = function() {};

/** @inheritDoc */
AbstractEdge.prototype.getVertex1 = function() {
  return this.v1_;
};

/** @inheritDoc */
AbstractEdge.prototype.getVertex2 = function() {
  return this.v2_;
};

/** @inheritDoc @abstract */
AbstractEdge.prototype.highlight = function() {};

/** @inheritDoc @abstract */
AbstractEdge.prototype.improveAccuracyEdge = function(rbc, edge) {};

/** @inheritDoc @abstract */
AbstractEdge.prototype.intersection = function(p1_body, p2_body) {};

/** @inheritDoc */
AbstractEdge.prototype.intersectionPossible = function(edge, swellage) {
  var c1 = this.getCentroidWorld();
  var c2 = edge.getCentroidWorld();
  var dist = c1.subtract(c2).lengthSquared();
  var dist2 = UtilEngine.square(edge.getCentroidRadius() + this.getCentroidRadius() + swellage);
  return dist < dist2;
};

/** @inheritDoc @abstract */
AbstractEdge.prototype.isStraight = function() {};

/** @inheritDoc @abstract */
AbstractEdge.prototype.maxDistanceTo = function(p_body) {};

/** @inheritDoc */
AbstractEdge.prototype.pointOffset = function(p_body, length) {
  var n = this.getNormalBody(p_body);
  return p_body.add(n.multiply(length));
};

/** @inheritDoc */
AbstractEdge.prototype.setCentroidRadius = function(value) {
  this.centroidRadius_ = value;
};

/** @inheritDoc */
AbstractEdge.prototype.setVertex2 = function(vertex) {
  this.v2_ = vertex;
};

/** @inheritDoc @abstract */
AbstractEdge.prototype.testCollisionEdge = function(collisions, edge, time) {};

}); // goog.scope
