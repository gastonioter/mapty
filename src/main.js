import "dotenv/config";
// TODO: inputs validations
// TODO: filter workouts by ... (distance, duration, date, distance from current location)

import "bootstrap-icons/font/bootstrap-icons.css";

import { Loader } from "google-maps";
import { MarkerClusterer } from "@googlemaps/markerclusterer";
const loader = new Loader(process.env.GOOGLE_MAPS_API_KEY);


const form = document.querySelector(".form");
const containerWorkouts = document.querySelector(".workouts");
const inputType = document.querySelector(".form__input--type");
const viewAllMarksBtn = document.querySelector(".control.showAll");
const btnForm = document.querySelector(".form__btn");
const goToCurrentLocationBtn = document.querySelector(".control.current");
const noWorkoutsP = document.querySelector(".workouts p");
const modal = document.querySelector(".alert-outer");

const App = {
  map: null,
  marker: null,
  positionClicked: null,
  infowindow: null,
  markerSelected: null,
  markerCluster: null,
  workouts: [],
  markers: [],
  isEdition: false,
  workoutToEdit: null,
  currentCoords: null,
  markerToEdit: null,
  previousPositionMarker: null,
  init() {
    modal.addEventListener("click", this._handleClickOutside.bind(this));
    window.addEventListener("keyup", this._cancelWorkout.bind(this));
    form.addEventListener("submit", this._newWorkout.bind(this));
    inputType.addEventListener("change", this._toggleElevationField);
    containerWorkouts.addEventListener("click", this._moveToWorkout.bind(this));
    viewAllMarksBtn.addEventListener("click", this._viewAllMarks.bind(this));
    goToCurrentLocationBtn.addEventListener(
      "click",
      this.panToCurrentLocation.bind(this)
    );
    this._loadFromLocalStorage();
    this._getPosition();
  },

  _handleClickOutside(e) {

    const isOutside = !e.target.closest(".alert-inner");
    if (isOutside) {
      this._closeModal();
      return
    }
    if (e.target.classList.contains('btn')) {
      this._closeModal();
      return
    }
  },

  _showModal() {
    modal.classList.remove("hidden");
  },
  _closeModal() {
    modal.classList.add("hidden");
  },

  panToCurrentLocation() {
    this.map.setZoom(16);
    this.map.setCenter(this.currentCoords);
    if (this.marker) {
      this.marker.setMap(null);
    }

    this.marker = new google.maps.Marker({
      position: this.currentCoords, // Cambia las coordenadas
    });

    this.marker.setMap(this.map);
    this.positionClicked = this.currentCoords;
    this.infowindow.close();
  },

  _viewAllMarks(e) {
    if (this.workouts.length == 0) return
    const bounds = new google.maps.LatLngBounds();
    // Iterar a través de todos los marcadores y ampliar los límites
    this.markers.forEach((m) => {
      bounds.extend(m.getPosition());
    });
    // Ajustar la vista del mapa para que todos los marcadores estén visibles
    this.map.fitBounds(bounds);
  },

  _moveToWorkout(e) {
    let workoutEl = e.target.closest(".workout");
    if (!workoutEl) return;

    const id = workoutEl.dataset.id;
    const workout = this.workouts.find((w) => w.id == id);

    if (e.target.classList.contains("actions__delete")) {
      workoutEl.remove();

      const workoutIndex = this.workouts.findIndex((w) => w.id == id);

      this.workouts.splice(workoutIndex, 1);
      if (this.workouts.length == 0) {
        noWorkoutsP.classList.remove("hidden");
      }

      const markerToDelete = this.findMarkerByCoords(workout.coords);
      //console.log(markerToDelete);

      this.markers.splice(this.markers.indexOf(markerToDelete), 1);

      markerToDelete.setMap(null);
      this.updateCluester(this.markers, true);
      this._saveToLocalStorage();

      return;
    } else if (e.target.classList.contains("actions__edit")) {
      this._editWorkout(e);
      return;
    }

    this.map.panTo(workout.coords);
    const markerSelected = this.findMarkerByCoords(workout.coords);
    this.map.setCenter(workout.coords);
    this.infowindow.close();
    this.showInfoMarker(markerSelected, workout);
  },

  findMarkerByCoords({ lat, lng }) {
    const markerSelected = this.markers.find(function (marker) {
      const position = marker.getPosition();
      const latMarker = position.lat();
      const lngMarker = position.lng();

      return lat == latMarker && lng == lngMarker;
    });

    return markerSelected;
  },

  _loadFromLocalStorage() {
    const workouts = JSON.parse(localStorage.getItem("workouts"));
    if (!workouts) return;

    workouts.forEach((w) => {
      w.date = new Date(w.date);

      Object.setPrototypeOf(cyclingProto, workoutProto);
      Object.setPrototypeOf(runningProto, workoutProto);
      w.type == "running"
        ? Object.setPrototypeOf(w, runningProto)
        : Object.setPrototypeOf(w, cyclingProto);

      this._renderWorkoutList(w);
    });

    this.workouts = workouts;
    if (workouts.length == 0) noWorkoutsP.classList.remove("hidden");
    else noWorkoutsP.classList.add("hidden");
  },

  _saveToLocalStorage() {
    localStorage.setItem("workouts", JSON.stringify(this.workouts));
  },

  updateCluester(markersArray, reset = false) {
    if (reset) {



      this.markerCluster.clearMarkers();
      this.markerCluster.addMarkers(markersArray);

      return;
    }
    this.markerCluster.addMarkers(markersArray);
    return;
  },

  _cancelEditionOp() {
    this.markerToEdit.setAnimation(null);
    this.markerToEdit.setDraggable(false);
    this.markerToEdit.setPosition(this.previousPositionMarker);
    this.markerToEdit = null;
    this.workoutToEdit = null;
  },


  _cancelWorkout(e) {
    if (e.key != "Escape") return;

    form.reset();
    this.marker?.setMap(null);
    form.classList.add("hidden");
    if (this.isEdition) {
      this._cancelEditionOp();
    }
    Array.from(containerWorkouts.children).forEach((w) => {
      w.classList.remove("selected");
    });

    if (this.workouts.length == 0) {
      noWorkoutsP.classList.remove("hidden");
    }
  },

  _getPosition() {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        this._loadMap.bind(this),
        function err(e) {
          console.log(err);
        }
      );
    }
  },

  _toggleElevationField() {
    form.elevation.closest(".form__row").classList.toggle("form__row--hidden");
    form.cadence.closest(".form__row").classList.toggle("form__row--hidden");
  },

  renderMarker(workout) {
    const url =
      "https://developers.google.com/maps/documentation/javascript/examples/full/images/beachflag.png";

    const marker = new google.maps.Marker({
      position: workout.coords, // Cambia las coordenadas
      icon: {
        url,
        scaledSize: new google.maps.Size(40, 40), // Tamaño del icono personalizado
      },
      draggable: false,
      animation: google.maps.Animation.DROP,
    });

    if (this.marker) this.marker.setMap(null);
    marker.setMap(this.map);

    marker.addListener(
      "click",
      this.showInfoMarker.bind(this, marker, workout)
    );
    marker.addListener("dragend", this._updateCoordsWorkout.bind(this));

    this.markers.push(marker);
    this.updateCluester([marker]);
  },

  async _updateCoordsWorkout(ev) {
    const newLat = ev.latLng.lat();
    const newLng = ev.latLng.lng();

    const isValidLocation = await this.workoutToEdit.reverseGeocode(newLat, newLng);
    if (isValidLocation) {
      this.markerToEdit.setPosition(ev.latLng);
      this.workoutToEdit.coords = { lat: newLat, lng: newLng };
    }
    else {
      this.markerToEdit.setPosition(this.previousPositionMarker);
    }

  },
  focusWorkout(workout) {
    containerWorkouts
      .querySelectorAll(".workout")
      .forEach((w) => w.classList.remove("selected"));
    const workoutEl = containerWorkouts.querySelector(
      `[data-id="${workout.id}"]`
    );
    workoutEl.classList.add("selected");
  },
  showInfoMarker(marker, workout) {
    this.map.panTo(workout.coords);
    const contentString = `<div class="custom-infowindow ${workout.type}-popup">${workout.getStringLocation()}</div>`;
    this.infowindow.setContent(contentString);
    this.infowindow.open(this.map, marker);
    this.focusWorkout(workout);

    this.marker?.setMap(null);
    form.classList.add("hidden");
  },

  async _newWorkout(e) {
    e.preventDefault();
    // helper functions
    const validInputs = (...inputs) =>
      inputs.every((inp) => Number.isFinite(inp));
    const allPositive = (...inputs) => inputs.every((inp) => inp > 0);

    // Get the date from the form.
    const disntance = +form.distance.value;
    const duration = +form.duration.value;
    const type = inputType.value;
    let isValidForm = false;


    // NEW WORKOUT

    let workout = {};

    if (type === "running") {
      // Check if data is valid.
      const cadence = +form.cadence.value;

      isValidForm =
        validInputs(disntance, duration, cadence) &&
        allPositive(disntance, duration, cadence);
      if (!isValidForm) return alert("Invalid Inputs!");
      Object.setPrototypeOf(workout, runningProto);
      if (this.isEdition) {
        this.workoutToEdit.cadence = cadence;
        this.workoutToEdit.distance = disntance;
        this.workoutToEdit.duration = duration;
        this._renderWorkoutList(this.workoutToEdit);
      } else {
        workout.initialize(disntance, duration, this.positionClicked, cadence);

      }
    }

    if (type === "cycling") {

      const elevation = +form.elevation.value;
      isValidForm =
        validInputs(disntance, duration, elevation) &&
        allPositive(disntance, duration);
      if (!isValidForm) return alert("Invalid Inputs!");

      if (this.isEdition) {
        this.workoutToEdit.cadence = cadence;
        this.workoutToEdit.distance = disntance;
        this.workoutToEdit.duration = duration;
        this._renderWorkoutList(this.workoutToEdit);
      } else {
        Object.setPrototypeOf(workout, cyclingProto);
        workout.initialize(
          disntance,
          duration,
          this.positionClicked,
          elevation
        );


      }
    }

    if (!this.isEdition) {
      this.renderMarker(workout);
      this._renderWorkoutList(workout);

      await workout.reverseGeocode();
      this.workouts.push(workout);
    }

    if (this.isEdition) {
      this.markerToEdit.setAnimation(null);
      this.markerToEdit.setDraggable(false);
      this.isEdition = false;
    }

    form.reset();
    form.classList.add("hidden");
    this._saveToLocalStorage();
  },

  _renderWorkoutList(workout) {
    let html = `<li class="workout workout--${workout.type}" data-id="${workout.id
      }">
          <h2 class="workout__title">${workout.description}</h2>
           <div class="workout__actions">
           <i class="bi bi-pencil actions__edit"></i>
           <i class="bi bi-x-circle actions__delete"></i>
          </div>
          <div class="workout__details">
            <span class="workout__icon">${workout.type == "running" ? "🏃‍♂️" : "🚴‍♀️"
      }</span>
            <span class="workout__value">${workout.distance}</span>
            <span class="workout__unit">km</span>
          </div>
          <div class="workout__details">
            <span class="workout__icon">⏱</span>
            <span class="workout__value">${workout.duration}</span>
            <span class="workout__unit">min</span>
          </div>`;

    if (workout.type == "running") {
      html += `<div class="workout__details">
            <span class="workout__icon">⚡️</span>
            <span class="workout__value">${workout.pace.toFixed(1)}</span>
            <span class="workout__unit">min/km</span>
          </div>
          <div class="workout__details">
            <span class="workout__icon">🦶🏼</span>
            <span class="workout__value">${workout.cadence}</span>
            <span class="workout__unit">spm</span>
          </div>
        </li>`;
    } else {
      html += `<div class="workout__details">
            <span class="workout__icon">⚡️</span>
            <span class="workout__value">${workout.speed.toFixed(1)}</span>
            <span class="workout__unit">km/h</span>
          </div>
          <div class="workout__details">
            <span class="workout__icon">⛰</span>
            <span class="workout__value">${workout.elevationGain}</span>
            <span class="workout__unit">m</span>
          </div>
        </li>`;
    }

    if (!this.isEdition) {
      containerWorkouts.insertAdjacentHTML("beforeend", html);
      return;
    }
    let workoutEl = containerWorkouts.querySelector(
      `[data-id="${workout.id}"]`
    );
    const parentWorkout = workoutEl.previousElementSibling;
    workoutEl.remove();
    parentWorkout.insertAdjacentHTML("afterend", html);
  },
  async _showForm(e) {
    if (this.isEdition) return;
    this.marker && this.marker.setMap(null);
    this.infowindow?.close();
    const { lat, lng } = e.latLng;

    const isValidLocation = await workoutProto.reverseGeocode(lat(), lng());

    if (!isValidLocation) {
      this._showModal();
      form.classList.add("hidden");
      return
    }
    noWorkoutsP.classList.add("hidden");
    this.marker = new google.maps.Marker({
      position: { lat: lat(), lng: lng() }, // Cambia las coordenadas
    });

    this.marker.setMap(this.map);
    this.positionClicked = { lat: lat(), lng: lng() };

    form.classList.remove("hidden");
    btnForm.textContent = "CREATE WORKOUT";
    form.distance.focus();
  },

  _editWorkout(e) {
    if (!e.target.closest(".workout")) return;
    if (this.isEdition) {
      this._cancelEditionOp();
    }
    this.isEdition = true;
    const workoutEl = e.target.closest(".workout");
    const workout = this.workouts.find((w) => w.id == workoutEl.dataset.id);
    this.workoutToEdit = workout;

    function autocompleteValues() {
      const { distance, duration } = workout;
      form.distance.value = distance;
      form.duration.value = duration;
      if (workout.type == "running") {
        const cadence = workout.cadence;
        form.cadence.value = cadence;
      }

      if (workout.type == "cycling") {
        const elevationGain = workout.elevationGain;
        form.elevationGain.value = elevationGain;
      }
    }

    autocompleteValues();

    this.markerToEdit = this.findMarkerByCoords(workout.coords);
    this.markerToEdit.setAnimation(google.maps.Animation.BOUNCE);
    this.markerToEdit.setDraggable(true);
    this.previousPositionMarker = this.markerToEdit.getPosition();

    form.classList.remove("hidden");
    btnForm.textContent = "EDIT WORKOUT";
  },

  async _loadMap(data) {
    const { latitude: lat, longitude: lng } = data.coords;
    this.currentCoords = { lat, lng };
    const google = await loader.load();
    const { Map, InfoWindow } = google.maps;
    this.infowindow = new InfoWindow({ maxWidth: 250, minWidth: 100 });
    this.map = new Map(document.getElementById("map"), {
      zoom: 8,
      maxZoom: 10,
      minZoom: 3,
      center: { lat, lng },
      disableDefaultUI: true,
      zoomControl: true,
      mapTypeControl: false,
      // mapTypeControlOptions: {
      //   style: google.maps.MapTypeControlStyle.DROPDOWN_MENU,
      //   mapTypeIds: ["roadmap"],
      // },
      scaleControl: false,
      streetViewControl: false,
      rotateControl: false,
      fullscreenControl: true,
      styles: [
        {
          featureType: "poi",
          stylers: [{ visibility: "off" }],
        },
        {
          featureType: "transit",
          stylers: [{ visibility: "off" }],
        },
      ],
    });

    this.markerCluster = new MarkerClusterer({
      map: this.map,
      markers: this.markers,
    });

    this.workouts.forEach((w) => {
      this.renderMarker(w);
    });

    if (this.workouts.length > 0) this._viewAllMarks();

    this.map.addListener("click", this._showForm.bind(this));
    this.customUI();
  },

  customUI() {
    // Crea un control personalizado para el botón y agrégalo al mapa
    this.map.controls[google.maps.ControlPosition.TOP_LEFT].push(
      viewAllMarksBtn
    );
    this.map.controls[google.maps.ControlPosition.TOP_LEFT].push(
      goToCurrentLocationBtn
    );
  },
};

const workoutProto = {
  init(distance, duration, coords) {
    this.date = new Date();
    this.id = (Date.now() + "").slice(-10);
    this.distance = distance; // km
    this.duration = duration; // mins
    this.coords = coords;

  },

  get description() {
    // prettier-ignore
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

    return `${this.type.at(0).toUpperCase()}${this.type.slice(1)} on ${months[this.date.getMonth()]
      } ${this.date.getDate()}`;
  },

  async reverseGeocode(lat = this.coords.lat, lng = this.coords.lng) {
    try {
      const res = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${process.env.GOOGLE_MAPS_API_KEY}&result_type=country|administrative_area_level_1|administrative_area_level_2|locality|sublocality`);
      const data = await res.json();
      let fullLocation = data.plus_code.compound_code;
      if (!fullLocation) {
        throw new Error("We couldn't find a valid location")
      }
      const [town, province, country] = fullLocation.split(',');
      this.location = {
        country,
        province,
        town
      }

      return true
    } catch (e) {
      //console.log(e);
      return false
      // TODO: notify error
    }
  },

  getStringLocation() {
    return `${this.location.town.split(' ').slice(1).join(' ')},${this.location.province || ''}${this.location.country ? ', ' + this.location.country : ''}`
  }
};

const cyclingProto = {
  initialize(distance, duration, coords, elevationGain) {
    this.init(distance, duration, coords);
    this.type = "cycling";
    this.elevationGain = elevationGain;
    this.calcSpeed();
  },

  calcSpeed() {
    this.speed = this.distance / (this.duration / 60);
    return this.speed;
  },
};

const runningProto = {
  initialize(distance, duration, coords, cadence) {
    this.init(distance, duration, coords);
    this.type = "running";
    this.cadence = cadence;
    this._calcPace();
  },

  _calcPace() {
    this.pace = this.duration / this.distance;
    return this.pace;
  },
};

Object.setPrototypeOf(cyclingProto, workoutProto);
Object.setPrototypeOf(runningProto, workoutProto);

App.init();
