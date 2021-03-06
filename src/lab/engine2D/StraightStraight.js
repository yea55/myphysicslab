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

goog.provide('myphysicslab.lab.engine2D.StraightStraight');

goog.require('myphysicslab.lab.engine2D.Edge');
goog.require('myphysicslab.lab.engine2D.AbstractEdge');
goog.require('myphysicslab.lab.engine2D.EdgeEdgeCollision');
goog.require('myphysicslab.lab.engine2D.RigidBody');
goog.require('myphysicslab.lab.engine2D.RigidBodyCollision');
goog.require('myphysicslab.lab.engine2D.UtilEngine');
goog.require('myphysicslab.lab.engine2D.UtilityCollision');
goog.require('myphysicslab.lab.engine2D.Vertex');
goog.require('myphysicslab.lab.engine2D.ConcreteVertex');
goog.require('myphysicslab.lab.util.UtilityCore');
goog.require('myphysicslab.lab.util.Vector');

goog.scope(function() {

var ConcreteVertex = myphysicslab.lab.engine2D.ConcreteVertex;
var AbstractEdge = myphysicslab.lab.engine2D.AbstractEdge;
var EdgeEdgeCollision = myphysicslab.lab.engine2D.EdgeEdgeCollision;
var NF5 = myphysicslab.lab.util.UtilityCore.NF5;
var NF7 = myphysicslab.lab.util.UtilityCore.NF7;
var RigidBody = myphysicslab.lab.engine2D.RigidBody;
var RigidBodyCollision = myphysicslab.lab.engine2D.RigidBodyCollision;
var UtilEngine = myphysicslab.lab.engine2D.UtilEngine;
var UtilityCollision = myphysicslab.lab.engine2D.UtilityCollision;
var UtilityCore = myphysicslab.lab.util.UtilityCore;
var Vector = myphysicslab.lab.util.Vector;
var Vertex = myphysicslab.lab.engine2D.Vertex;

/** Provides static functions for handling interactions between two
{@link myphysicslab.lab.engine2D.StraightEdge StraightEdges}.

@constructor
@final
@struct
@private
*/
myphysicslab.lab.engine2D.StraightStraight = function() {
  throw new Error();
};
var StraightStraight = myphysicslab.lab.engine2D.StraightStraight;

/** Returns intersection point of the two StraightEdges.
* @param {!myphysicslab.lab.engine2D.StraightEdge} edge1
* @param {!myphysicslab.lab.engine2D.StraightEdge} edge2
* @return {?Vector} intersection point or null if no intersection
* @private
*/
StraightStraight.intersect = function(edge1, edge2) {
  var body1 = edge1.getBody();
  var body2 = edge2.getBody();
  var e1v1 = edge1.getVertex1();
  var e1v2 = edge1.getVertex2();
  var e2v1 = edge2.getVertex1();
  var e2v2 = edge2.getVertex2();
  return UtilEngine.linesIntersect(body1.bodyToWorld(e1v1.locBody()),
      body1.bodyToWorld(e1v2.locBody()),
      body2.bodyToWorld(e2v1.locBody()),
      body2.bodyToWorld(e2v2.locBody()));
};

/** Updates the EdgeEdgeCollision to have more accurate information based on current
positions and velocities of the RigidBodys.
* @param {!myphysicslab.lab.engine2D.EdgeEdgeCollision} rbc
* @param {!myphysicslab.lab.engine2D.StraightEdge} edge1
* @param {!myphysicslab.lab.engine2D.StraightEdge} edge2
*/
StraightStraight.improveAccuracy = function(rbc, edge1, edge2) {
  var edge1Body = edge1.getBody();
  var edge2Body = edge2.getBody();
  goog.asserts.assert( rbc.getPrimaryBody() == edge1Body);
  goog.asserts.assert( rbc.getNormalBody() == edge2Body);
  // The scenario is:  collision between a edge1 and edge2 happened,
  // it was detected by the two lines intersecting.
  var pt = StraightStraight.intersect(edge1, edge2);
  if (pt != null) {
    // If the lines are still intersecting, then use the current point of intersection.
    rbc.impact1 = pt;
    rbc.r1 = pt.subtract(edge1.getBody().getPosition());
    rbc.r2 = pt.subtract(edge2.getBody().getPosition());
    rbc.normal = edge2.getBody().rotateBodyToWorld(edge2.getNormalBody(pt));
  } else {
    // If lines are not intersecting, then use endpoint that is closest to other line.
    // This will be the endpoint with smallest positive distance.
    var dist = UtilityCore.POSITIVE_INFINITY;
    var body1 = edge1.getBody();
    var body2 = edge2.getBody();
    var e1v1 = body1.bodyToWorld(edge1.getVertex1().locBody());
    var e1v2 = body1.bodyToWorld(edge1.getVertex2().locBody());
    var e2v1 = body2.bodyToWorld(edge2.getVertex1().locBody());
    var e2v2 = body2.bodyToWorld(edge2.getVertex2().locBody());
    var e = null;
    var d = edge1.distanceToLine(e2v1);
    if (d > 0 && d < dist) {
      e = edge1;
      pt = e2v1;
      dist = d;
    }
    d = edge1.distanceToLine(e2v2);
    if (d > 0 && d < dist) {
      e = edge1;
      pt = e2v2;
      dist = d;
    }
    d = edge2.distanceToLine(e1v1);
    if (d > 0 && d < dist) {
      e = edge2;
      pt = e1v1;
      dist = d;
    }
    d = edge2.distanceToLine(e1v2);
    if (d > 0 && d < dist) {
      e = edge2;
      pt = e1v2;
      dist = d;
    }
    if (pt != null && e != null) {
      rbc.distance = dist;
      rbc.impact1 = pt;
      rbc.r1 = pt.subtract(edge1.getBody().getPosition());
      rbc.r2 = pt.subtract(edge2.getBody().getPosition());
      rbc.normal = e.getBody().rotateBodyToWorld(e.getNormalBody(pt));
    } else {
      throw new Error('StraightStraight.improveAccuracy failed');
    }
  }
};

/** Tests the positions and velocities of the two Edges, and if a collision
* is detected, adds an EdgeEdgeCollision to the given array.
* @param {!Array<!myphysicslab.lab.engine2D.RigidBodyCollision>} collisions any new
*    collision will be added to this array
* @param {!myphysicslab.lab.engine2D.StraightEdge} edge1
* @param {!myphysicslab.lab.engine2D.StraightEdge} edge2
* @param {number} time current simulation time
*/
StraightStraight.testCollision = function(collisions, edge1, edge2, time) {
  if (UtilityCollision.DISABLE_EDGE_EDGE)
    return;
  var pt = StraightStraight.intersect(edge1, edge2);
  if (pt != null) {
    StraightStraight.addCollision(collisions, edge1, edge2, pt, time);
  }
};

/**
* @param {!Array<!myphysicslab.lab.engine2D.RigidBodyCollision>} collisions
* @param {!myphysicslab.lab.engine2D.StraightEdge} edge1
* @param {!myphysicslab.lab.engine2D.StraightEdge} edge2
* @param {!myphysicslab.lab.util.Vector} pt collision point in world coords
* @param {number} time current simulation time
* @private
*/
StraightStraight.addCollision = function(collisions, edge1, edge2, pt, time) {
  var rbc = new EdgeEdgeCollision(edge1, edge2);
  rbc.ballNormal = false;
  rbc.ballObject = false;
  rbc.radius1 = UtilityCore.POSITIVE_INFINITY;
  rbc.radius2 = UtilityCore.POSITIVE_INFINITY;
  rbc.distance = -0.1; // distance is meaningless for edge/edge collision
  rbc.impact1 = pt;
  rbc.r1 = pt.subtract(edge1.getBody().getPosition());
  rbc.r2 = pt.subtract(edge2.getBody().getPosition());
  rbc.creator = goog.DEBUG ? 'StraightStraight' : '';
  rbc.normal = edge2.getBody().rotateBodyToWorld(edge2.getNormalBody(pt));
  rbc.normalVelocity = rbc.calcNormalVelocity();
  rbc.setDetectedTime(time);
  UtilityCollision.addCollision(collisions, rbc);
  console.log('StraightStraight.addCollision '+rbc);
};

}); // goog.scope
