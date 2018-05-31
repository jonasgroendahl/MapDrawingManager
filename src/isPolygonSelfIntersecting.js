export default function isPolygonSelfIntersecting(polygonPath) {
  let intersects = false;

  let lines = new Array();

  for (let i = 0; i < polygonPath.length; i++) {
    let path1, path2;

    if (i === polygonPath.length - 1) {
      path1 = polygonPath[i];
      path2 = polygonPath[0];
    } else {
      path1 = polygonPath[i];
      path2 = polygonPath[i + 1];
    }

    let start = path1.lng() > path2.lng() ? path1 : path2;
    let end = path1.lng() < path2.lng() ? path1 : path2;

    let line = Primitives.constructLine(start, end);
    lines.push({ line: line, start: start, end: end });
  }

  outer: for (var i = 0; i < lines.length; i++) {
    for (var j = i + 2; j < lines.length; j++) {
      if (j === lines.length - 1 && i === 0) {
        continue;
      }

      let firstLine = lines[i];
      let secondLine = lines[j];

      let firstSidedness = Primitives.sidedness(
        secondLine.start,
        firstLine.line
      );
      let secondSidedness = Primitives.sidedness(
        secondLine.end,
        firstLine.line
      );

      let firstOtherSidedness = Primitives.sidedness(
        firstLine.start,
        secondLine.line
      );
      let secondOtherSidedness = Primitives.sidedness(
        firstLine.end,
        secondLine.line
      );

      if (firstSidedness === "ABOVE" && secondSidedness === "ABOVE") {
        intersects = false;
      } else if (firstSidedness === "BELOW" && secondSidedness === "BELOW") {
        intersects = false;
      } else if (
        firstOtherSidedness === "ABOVE" &&
        secondOtherSidedness === "ABOVE"
      ) {
        intersects = false;
      } else if (
        firstOtherSidedness === "BELOW" &&
        secondOtherSidedness === "BELOW"
      ) {
        intersects = false;
      } else {
        intersects = true;
        break outer;
      }
    }
  }

  return intersects;
}

class Primitives {
  static constructLine(firstPoint, secondPoint) {
    let a =
      (secondPoint.lat() - firstPoint.lat()) /
      (secondPoint.lng() - firstPoint.lng());
    let b = firstPoint.lat() - a * firstPoint.lng();

    return x => a * x + b;
  }

  static sidedness(point, line) {
    let lat = line(point.lng());

    let sidedness = "";

    if (point.lat() > lat) {
      sidedness = "ABOVE";
    } else if (point.lat() < lat) {
      sidedness = "BELOW";
    } else {
      sidedness = "ON";
    }

    return sidedness;
  }
}
