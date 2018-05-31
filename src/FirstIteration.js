import React from "react";
import { point, distance } from "@turf/turf";
import polyconSvg from "./polygon-marker.svg";

let google = window.google;

export default class MapDrawingManager extends React.Component {
  constructor(props) {
    super(props);
    this.map = null;
    this.mapRef = React.createRef();
    this.addMarkerListener = null;
    this.polygon = null;
    this.polyline = null;
    this.state = {
      markers: [],
      actions: [],
      actionIndex: -1,
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
          url: polyconSvg,
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
    let { markers, actions, actionIndex } = this.state;
    let finished = false;
    if (markers.length > 2) {
      const point1 = point([marker.position.lat(), marker.position.lng()]);
      const point2 = point([
        markers[0].position.lat(),
        markers[0].position.lng()
      ]);
      /* Check if we are within reach of the first marker */
      if (distance(point1, point2) < 0.05) {
        finished = true;
      }
    }
    if (finished) {
      this.removeAddMarkerListener();
      this.drawPolygon();
      this.polyline.setMap(null);
      marker.setMap(null);
    } else {
      markers.push(marker);
      const action = { type: "ADD", obj: marker };
      actions.push(action);
      actionIndex = actions.length - 1;
      this.setState({ markers, actions, actionIndex });
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
    if (this.polygon) this.polygon.setMap(null);

    this.polygon = new google.maps.Polygon({
      paths: markers.map(
        poly => new google.maps.LatLng(poly.position.lat(), poly.position.lng())
      ),
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
    /* disable creating markers map on click and add listeners for clicking markers and dragging them */
    google.maps.event.removeListener(this.addMarkerListener);
    this.drawingManager.setDrawingMode(null);
    this.addListeners();
  };

  addListeners = () => {
    let { actions, actionIndex, markers } = this.state;
    markers.forEach(marker => {
      google.maps.event.addListener(marker, "dragend", event => {
        this.drawPolygon();
        actions[actionIndex].obj.positionTo = event.latLng;
      });
      google.maps.event.addListener(marker, "click", event => {
        this.setState({ selectedMarker: marker });
      });
      google.maps.event.addListener(marker, "dragstart", event => {
        const index = markers.findIndex(m => m === marker);
        actions.push({
          type: "MOVE",
          obj: { index, positionFrom: event.latLng }
        });
        actionIndex = actions.length - 1;
        this.setState({ actions, actionIndex });
      });
    });
    actions.splice(0, actions.length + 1);
    actionIndex = -1;
    this.setState({ actions, actionIndex });
  };

  deleteHandler = () => {
    let { markers, actions, actionIndex, selectedMarker } = this.state;
    if (markers.length > 3 && selectedMarker) {
      const index = markers.findIndex(m => m === selectedMarker);
      markers.splice(index, 1);
      actionIndex = actions.length;
      selectedMarker.setMap(null);
      actions.push({ type: "DELETE", obj: selectedMarker, index });
      this.drawPolygon();
      this.setState({ actions, markers, actionIndex, selectedMarker: null });
    }
  };

  undoHandler = () => {
    let { markers, actions, actionIndex } = this.state;
    if (actionIndex >= 0) {
      if (actions[actionIndex].type === "ADD") {
        actions[actionIndex].obj.setMap(null);
        markers.pop();
        this.drawPolyline();
      } else if (actions[actionIndex].type === "DELETE") {
        markers.splice(actions[actionIndex].index, 0, actions[actionIndex].obj);
        actions[actionIndex].obj.setMap(this.map);
        this.drawPolygon();
      } else if (actions[actionIndex].type === "MOVE") {
        markers[actions[actionIndex].obj.index].setPosition(
          actions[actionIndex].obj.positionFrom
        );
        this.drawPolygon();
      }
      actionIndex = actionIndex - 1;
      this.setState({ actionIndex, markers, actions });
    }
  };

  redoHandler = () => {
    let { markers, actions, actionIndex } = this.state;
    if (actionIndex + 1 !== actions.length) {
      actionIndex = actionIndex + 1;
      if (actions[actionIndex].type === "ADD") {
        markers.push(actions[actionIndex].obj);
        actions[actionIndex].obj.setMap(this.map);
        this.drawPolyline();
      } else if (actions[actionIndex].type === "DELETE") {
        const index = markers.findIndex(m => m === actions[actionIndex].obj);
        markers.splice(index, 1);
        actions[actionIndex].obj.setMap(null);
        this.drawPolygon();
      } else if (actions[actionIndex].type === "MOVE") {
        markers[actions[actionIndex].obj.index].setPosition(
          actions[actionIndex].obj.positionTo
        );
        this.drawPolygon();
      }
      this.setState({ actionIndex, markers, actions });
    }
  };

  resetHandler = () => {
    /* reset all variables and re add markerListener for map */
    let { markers, actions, actionIndex } = this.state;
    markers.forEach(marker => marker.setMap(null));
    this.polyline.setMap(null);
    if (this.polygon) {
      this.polygon.setMap(null);
    }
    actions.splice(0, actions.length);
    actionIndex = -1;
    markers.splice(0, markers.length);
    this.drawingManager.setDrawingMode(google.maps.drawing.OverlayType.MARKER);
    google.maps.event.removeListener(this.addMarkerListener);
    this.setState({ actions, actionIndex, markers });
    this.addMarkerListener = google.maps.event.addListener(
      this.drawingManager,
      "markercomplete",
      this.markerCompleteCallback
    );
  };

  render() {
    const { actionIndex, actions, markers, selectedMarker } = this.state;
    const obj = {
      display: "flex",
      justifyContent: "center",
      marginTop: "30px"
    };

    const undoIsActive = actionIndex >= 0;
    const redoIsActive = actionIndex + 1 !== actions.length;
    const deleteIsActive = selectedMarker != null && markers.length > 3;
    const resetIsActive = markers.length > 0;

    return (
      <div>
        <div
          style={{ width: "100%", height: "300px" }}
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
