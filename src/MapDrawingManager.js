import React from "react";
import { point, distance } from "@turf/turf";
import polygonSvg from "./polygon-marker.svg";
import polygonSvgEdit from "./edit_location.svg";
import isPolygonSelfIntersecting from "./isPolygonSelfIntersecting";

let google = window.google;

export default class MapDrawingManager extends React.Component {
  constructor(props) {
    super(props);
    this.map = null;
    this.mapRef = React.createRef();
    this.addMarkerListener = null;
    this.polygon = null;
    this.polyline = null;
    this.moveListener = null;
    this.insertListener = null;
    this.state = {
      markers: [],
      actions: [],
      acIndex: -1,
      selectedMarker: null
    };
  }

  componentDidMount() {
    /* init map */
    this.map = new google.maps.Map(this.mapRef.current, {
      center: { lat: 55.766007, lng: 9.58093 },
      zoom: 17,
      mapTypeId: google.maps.MapTypeId.SATELLITE
    });
    /* init drawing manager */
    this.drawingManager = new google.maps.drawing.DrawingManager({
      drawingMode: google.maps.drawing.OverlayType.MARKER,
      drawingControl: false,
      markerOptions: {
        optimized: false,
        icon: {
          url: polygonSvg,
          scaledSize: new google.maps.Size(20, 20),
          anchor: new google.maps.Point(20 / 2, 20 / 2)
        }
      },
      map: this.map
    });
    /* add listener for adding markers on map */
    this.addMarkerListener = google.maps.event.addListener(
      this.drawingManager,
      "markercomplete",
      this.markerCompleteCallback
    );
  }

  markerCompleteCallback = marker => {
    marker.setDraggable(true);
    let { markers, actions, acIndex } = this.state;
    let finished = false;
    if (markers.length > 2) {
      const point1 = point([marker.position.lat(), marker.position.lng()]);
      const point2 = point([
        markers[0].position.lat(),
        markers[0].position.lng()
      ]);
      /* Check if we are within reach of the first marker */
      if (distance(point1, point2) < 0.02) {
        finished = true;
      }
    }
    if (finished) {
      this.drawPolygon();
      this.polyline.setMap(null);
      marker.setMap(null);
      this.removeAddMarkerListener();
    } else {
      markers.push(marker);
      const action = { type: "ADD", obj: marker };
      actions.push(action);
      acIndex = actions.length - 1;
      this.setState({ markers, actions, acIndex });
      this.drawPolyline();
    }
  };

  drawPolyline = () => {
    const { markers } = this.state;
    if (this.polyline != null) this.polyline.setMap(null);
    this.polyline = new google.maps.Polyline({
      path: markers.map(
        poly => new google.maps.LatLng(poly.position.lat(), poly.position.lng())
      ),
      fillColor: "white",
      fillOpacity: 0.2,
      strokeColor: "white",
      strokeOpacity: 0.8,
      strokeWeight: 4,
      map: this.map
    });
  };

  drawPolygon = () => {
    const { markers } = this.state;
    this.polygon = new google.maps.Polygon({
      paths: markers.map(
        poly => new google.maps.LatLng(poly.position.lat(), poly.position.lng())
      ),
      editable: true,
      fillColor: "#aaaaaa",
      fillOpacity: 0.2,
      strokeColor: "white",
      strokeOpacity: 0.8,
      strokeWeight: 4,
      suppressUndo: true,
      optimized: false,
      map: this.map
    });
  };

  removeAddMarkerListener = () => {
    const { actions } = this.state;
    /* disable creating markers map on click and add listeners for clicking markers and dragging them */
    google.maps.event.removeListener(this.addMarkerListener);
    this.drawingManager.setDrawingMode(null);
    this.addListeners();
    actions.splice(0, actions.length);
    this.setState({ actions, acIndex: -1 });
  };

  checkIfIntersecting = () => {
    const polygonpath = [];
    for (let i = 0; i < this.polygon.getPath().getLength(); i++) {
      polygonpath.push(this.polygon.getPath().getAt(i));
    }
    const intersect = isPolygonSelfIntersecting(polygonpath);
    if (intersect) {
      this.polygon.setOptions({ fillColor: "#E57373" });
    } else {
      this.polygon.setOptions({ fillColor: "#aaaaaa" });
    }
  };

  addListeners = () => {
    const { markers } = this.state;
    markers.forEach(marker => marker.setMap(null));
    this.insertListener = google.maps.event.addListener(
      this.polygon.getPath(),
      "insert_at",
      this.onInsert
    );
    this.moveListener = google.maps.event.addListener(
      this.polygon.getPath(),
      "set_at",
      this.onMove
    );
    google.maps.event.addListener(
      this.polygon,
      "mousedown",
      this.onPolygonClick
    );
    google.maps.event.addListener(
      this.polygon,
      "mouseup",
      this.onPolygonRelease
    );
  };

  onMove = (index, point) => {
    const { actions } = this.state;
    actions.push({
      type: "MOVE",
      obj: {
        index,
        element: { to: point, from: this.polygon.getPath().getAt(index) }
      }
    });
    this.setState({
      actions,
      acIndex: actions.length - 1
    });
    this.checkIfIntersecting();
  };

  onInsert = (index, point) => {
    const { actions } = this.state;
    actions.push({
      type: "INSERT",
      obj: {
        index,
        element: this.polygon.getPath().getAt(index)
      }
    });
    this.setState({
      actions,
      acIndex: actions.length - 1
    });
    this.checkIfIntersecting();
  };

  onPolygonRelease = event => {
    const { selectedMarker } = this.state;
    if (selectedMarker) {
      const pos = this.polygon.getPath().getAt(event.vertex);
      selectedMarker.position = pos;
      selectedMarker.setMap(this.map);
      this.setState({ selectedMarker });
    }
  };

  onPolygonClick = event => {
    if (this.state.selectedMarker) {
      this.state.selectedMarker.setMap(null);
    }
    /* re attach listeners to keep action stack up to date */
    if (this.moveListener == null) {
      this.moveListener = google.maps.event.addListener(
        this.polygon.getPath(),
        "set_at",
        this.onMove
      );
    }
    if (this.insertListener === null) {
      this.insertListener = google.maps.event.addListener(
        this.polygon.getPath(),
        "insert_at",
        this.onInsert
      );
    }

    if (event.vertex !== undefined) {
      /* check if we already selected a marker and remove that from the map if that's the case */
      if (this.state.selectedMarker) {
        this.state.selectedMarker.setMap(null);
      }
      const markerOptions = {
        position: this.polygon.getPath().getAt(event.vertex),
        icon: polygonSvgEdit,
        map: this.map
      };
      this.setState({ selectedMarker: new google.maps.Marker(markerOptions) });
    }
  };

  deleteHandler = () => {
    const { selectedMarker, actions } = this.state;
    if (this.polygon.getPath().getLength() > 3 && selectedMarker != null) {
      this.polygon.getPath().forEach((element, index) => {
        if (element === selectedMarker.position) {
          this.polygon.getPath().removeAt(index);
          selectedMarker.setMap(null);
          actions.push({ type: "DELETE", obj: { index, element } });
          this.setState({
            selectedMarker: null,
            actions,
            acIndex: actions.length - 1
          });
        }
      });
      this.checkIfIntersecting();
    }
  };

  detachMoveListener = () => {
    google.maps.event.removeListener(this.moveListener);
    this.moveListener = null;
  };

  detachInsertListener = () => {
    google.maps.event.removeListener(this.insertListener);
    this.insertListener = null;
  };

  undoHandler = () => {
    let { markers, actions, acIndex, selectedMarker } = this.state;
    const action = actions[acIndex];
    if (acIndex >= 0) {
      if (selectedMarker != null) {
        selectedMarker.setMap(null);
      }
      this.detachMoveListener();
      this.detachInsertListener();
      if (action.type === "ADD") {
        action.obj.setMap(null);
        markers.pop();
        this.drawPolyline();
      } else if (action.type === "DELETE") {
        this.polygon.getPath().insertAt(action.obj.index, action.obj.element);
      } else if (action.type === "MOVE") {
        this.polygon.getPath().setAt(action.obj.index, action.obj.element.to);
      } else if (action.type === "INSERT") {
        this.polygon.getPath().removeAt(action.obj.index);
      }
      acIndex = acIndex - 1;
      this.checkIfIntersecting();
      this.setState({ acIndex, markers, actions, selectedMarker: null });
    }
  };

  redoHandler = () => {
    let { markers, actions, acIndex, selectedMarker } = this.state;
    if (acIndex + 1 !== actions.length) {
      if (selectedMarker != null) {
        selectedMarker.setMap(null);
      }
      acIndex = acIndex + 1;
      const action = actions[acIndex];
      this.detachMoveListener();
      this.detachInsertListener();
      if (action.type === "ADD") {
        markers.push(action.obj);
        action.obj.setMap(this.map);
        this.drawPolyline();
      } else if (action.type === "DELETE") {
        this.polygon.getPath().removeAt(action.obj.index, action.obj.element);
      } else if (action.type === "MOVE") {
        this.polygon.getPath().setAt(action.obj.index, action.obj.element.from);
      } else if (action.type === "INSERT") {
        this.polygon.getPath().insertAt(action.obj.index, action.obj.element);
      }
      this.checkIfIntersecting();
      this.setState({ acIndex, markers, actions, selectedMarker: null });
    }
  };

  resetHandler = () => {
    /* reset all variables and re add markerListener for map */
    let { markers, actions, acIndex, selectedMarker } = this.state;
    markers.forEach(marker => marker.setMap(null));
    this.polyline.setMap(null);
    if (this.polygon) {
      this.polygon.setMap(null);
    }
    if (selectedMarker) {
      selectedMarker.setMap(null);
    }
    actions.splice(0, actions.length);
    acIndex = -1;
    markers.splice(0, markers.length);
    this.drawingManager.setDrawingMode(google.maps.drawing.OverlayType.MARKER);
    google.maps.event.removeListener(this.addMarkerListener);
    this.setState({ actions, acIndex, markers, selectedMarker: null });
    this.addMarkerListener = google.maps.event.addListener(
      this.drawingManager,
      "markercomplete",
      this.markerCompleteCallback
    );
  };

  render() {
    const { acIndex, actions, markers, selectedMarker } = this.state;
    const obj = {
      display: "flex",
      justifyContent: "center",
      marginTop: "30px"
    };

    const undoIsActive = acIndex >= 0;
    const redoIsActive = acIndex + 1 !== actions.length;
    const deleteIsActive = selectedMarker != null && markers.length > 3;
    const resetIsActive = markers.length > 0;

    return (
      <div>
        <div
          style={{ width: "100%", height: "400px" }}
          id="map"
          ref={this.mapRef}
        />
        <div style={obj}>
          <button
            onClick={this.deleteHandler}
            style={deleteIsActive ? { background: "#69F0AE" } : {}}
          >
            Delete
          </button>
          <button
            onClick={this.undoHandler}
            style={undoIsActive ? { background: "#69F0AE" } : {}}
          >
            Undo
          </button>
          <button
            onClick={this.redoHandler}
            style={redoIsActive ? { background: "#69F0AE" } : {}}
          >
            Redo
          </button>
          <button
            onClick={this.resetHandler}
            style={resetIsActive ? { background: "#69F0AE" } : {}}
          >
            Reset
          </button>
        </div>
      </div>
    );
  }
}
