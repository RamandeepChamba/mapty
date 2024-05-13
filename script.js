'use strict';

class Workout {
  date = new Date();
  id = (Date.now() + '').slice(-10);
  clicks = 0;

  constructor(coords, distance, duration) {
    this.coords = coords; // [lat, lng]
    this.distance = distance; // in km
    this.duration = duration; // in min
  }

  _setDescription() {
    // prettier-ignore
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    // [BUG] months undefined on child
    this.description = `${this.type[0].toUpperCase()}${this.type.slice(1)} on ${
      months[this.date.getMonth()]
    } ${this.date.getDate()}`;
  }
  click() {
    this.clicks++;
  }
}

class Running extends Workout {
  type = 'running';
  constructor(coords, distance, duration, cadence) {
    super(coords, distance, duration);
    this.cadence = cadence;
    this.calcPace();

    this._setDescription();
  }

  calcPace() {
    // min/km
    this.pace = this.duration / this.distance;
    return this.pace;
  }
}
class Cycling extends Workout {
  type = 'cycling';
  constructor(coords, distance, duration, elevationGain) {
    super(coords, distance, duration);
    this.elevationGain = elevationGain;
    this.calcSpeed();
    this._setDescription();
  }
  calcSpeed() {
    // km/hr
    this.speed = this.distance / (this.duration / 60);
    return this.speed;
  }
}
///////////////////////////////////
// APPLICATION ARCHITECTURE
const form = document.querySelector('.form');
const containerWorkouts = document.querySelector('.workouts');
const inputType = document.querySelector('.form__input--type');
const inputDistance = document.querySelector('.form__input--distance');
const inputDuration = document.querySelector('.form__input--duration');
const inputCadence = document.querySelector('.form__input--cadence');
const inputElevation = document.querySelector('.form__input--elevation');
const sortDistanceBtnEl = document.querySelector('#sort-distance');
const sortDurationBtnEl = document.querySelector('#sort-duration');
const sortDistanceStatusEl = document.querySelector('.sort-distance-status i');
const sortDurationStatusEl = document.querySelector('.sort-duration-status i');
const deleteAllEl = document.querySelector('.delete-all');

class App {
  #map;
  #mapEvent;
  #workouts = [];
  #markers = [];
  #mapZoomLevel = 13;
  #editing = false;
  #editingId;
  #deleteDuration = 500;
  #editedDuration = 2000;
  // had to make below objects as need to use them by reference later
  #sortDistanceStatus = { status: null }; // 0 - ascending, 1 - desc, null - none
  #sortDurationStatus = { status: null }; // 0 - ascending, 1 - desc, null - none
  #activeFilter = null; // distance, duration, null

  constructor() {
    // Get data from local storage
    this._getLocalStorage();
    this._getPosition();
    // Handle form submit
    form.addEventListener('submit', this._handleWorkout.bind(this));
    // Handle workout type change
    inputType.addEventListener('change', this._toggleElevationField);
    // Handle list workout click
    containerWorkouts.addEventListener(
      'click',
      this._handleListClick.bind(this)
    );
    // Handle sort select change filter
    sortDistanceBtnEl.addEventListener(
      'click',
      this._handleSortByFilter.bind(this, 'distance')
    );
    sortDurationBtnEl.addEventListener(
      'click',
      this._handleSortByFilter.bind(this, 'duration')
    );
    // Handle delete all
    deleteAllEl.addEventListener('click', this._removeAllWorkouts.bind(this));
  }

  _getPosition() {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        this._loadMap.bind(this),
        function () {
          alert('Could not get your position');
        }
      );
    }
  }
  _loadMap(position) {
    const { latitude, longitude } = position.coords;
    const coords = [latitude, longitude];
    this.#map = L.map('map').setView(coords, this.#mapZoomLevel);
    // console.log(map);
    L.tileLayer('https://tile.openstreetmap.fr/hot/{z}/{x}/{y}.png', {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(this.#map);

    // Handling click on map
    this.#map.on('click', this._showForm.bind(this));

    this.#workouts.forEach(work => {
      // render map markers
      this._renderWorkoutMarker(work);
    });
  }
  _showForm(mapE) {
    this.#mapEvent = mapE;
    form.classList.remove('hidden');
    inputDistance.focus();
  }
  _hideForm() {
    // Clear input fields
    inputCadence.value =
      inputDistance.value =
      inputDuration.value =
      inputElevation.value =
        '';
    // hide form
    form.style.display = 'none';
    form.classList.add('hidden');
    setTimeout(() => (form.style.display = 'grid'), 1000);
  }
  _toggleElevationField() {
    inputElevation.closest('.form__row').classList.toggle('form__row--hidden');
    inputCadence.closest('.form__row').classList.toggle('form__row--hidden');
  }
  _renderWorkoutMarker(workout) {
    const marker = L.marker(workout.coords)
      .addTo(this.#map)
      .bindPopup(
        L.popup({
          maxWidth: 250,
          minWidth: 100,
          autoClose: false,
          closeOnClick: false,
          className: `${workout.type}-popup`,
        })
      )
      .setPopupContent(
        `${workout.type === 'running' ? '🏃‍♂️' : '🚴'} ${workout.description}`
      )
      .openPopup();
    const markerRef = {
      marker,
      parentId: workout.id,
    };
    // save reference to marker
    this.#markers.push(markerRef);
  }
  _renderWorkout(workout, style = true, highlightId = null) {
    let html = `
      <li class="workout workout--${workout.type}" data-id="${workout.id}">
        <h2 class="workout__title">
        ${workout.description}
        <span class="workout__edit"><i class="fa-solid fa-pen"></i></span>
        <span class="workout__delete"><i class="fa-solid fa-trash"></i></span>
        </h2>
        <div class="workout__details">
          <span class="workout__icon">${
            workout.type === 'running' ? '🏃‍♂️' : '🚴'
          }</span>
          <span class="workout__value">${workout.distance}</span>
          <span class="workout__unit">km</span>
        </div>
        <div class="workout__details">
          <span class="workout__icon">⏱</span>
          <span class="workout__value">${workout.duration}</span>
          <span class="workout__unit">min</span>
        </div>
    `;

    if (workout.type === 'running') {
      html += `
        <div class="workout__details">
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
    }

    if (workout.type === 'cycling') {
      html += `
        <div class="workout__details">
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

    if (!this.#editing) {
      // append
      form.insertAdjacentHTML('afterend', html);
    }
    if (this.#editing) {
      // replace
      const workoutEl = document.querySelector(
        `.workout[data-id="${workout.id}"]`
      );
      workoutEl.outerHTML = html;
    }
    if (style) {
      this._workoutAdded(workout.id);
    } else if (highlightId && workout.id === highlightId) {
      this._workoutAdded(highlightId);
    }
  }
  _renderAllWorkouts(highlightId = null) {
    this.#workouts.forEach(workout =>
      this._renderWorkout(workout, false, highlightId)
    );
  }
  _moveToPopup(e) {
    const workoutEl = e.target.closest('.workout');
    if (!workoutEl) return;
    const workout = this.#workouts.find(w => w.id === workoutEl.dataset.id);
    this.#map.setView(workout.coords, this.#mapZoomLevel, {
      pan: {
        duration: 1,
      },
    });
    // workout.click();
  }
  _setLocalStorage() {
    localStorage.setItem('workouts', JSON.stringify(this.#workouts));
  }
  _getLocalStorage() {
    const data = JSON.parse(localStorage.getItem('workouts'));
    if (!data) return;

    // TODO
    // remake workout objects from local storage
    this.#workouts = data.map(workout => {
      let newWorkout;
      if (workout.type === 'running') {
        newWorkout = new Running(
          workout.coords,
          workout.distance,
          workout.duration,
          workout.cadence
        );
      }
      if (workout.type === 'cycling') {
        newWorkout = new Cycling(
          workout.coords,
          workout.distance,
          workout.duration,
          workout.elevationGain
        );
      }
      // preserve date, id
      newWorkout.id = workout.id;
      newWorkout.date = workout.date;

      return newWorkout;
    });
    // push remade workouts
    // this.#workouts = data;

    this.#workouts.forEach(work => {
      // render list
      this._renderWorkout(work);
    });
  }

  // Edit
  _handleListClick(e) {
    // pan map to item clicked
    this._moveToPopup(e);

    // Handle edit button
    if (e.target.closest('.workout__edit')) {
      // fetch id
      const id = e.target.closest('.workout').dataset.id;
      this.#editing = true;
      this.#editingId = id;
      // hide element
      this._hideWorkoutEl(id);
      // render form with data
      this._showUpdateForm(id);
    }
    // Handle delete button
    if (e.target.closest('.workout__delete')) {
      // fetch id
      const id = e.target.closest('.workout').dataset.id;
      // remove workout
      this._removeWorkout(id);
    }
  }
  _hideWorkoutEl(id) {
    const workoutEl = document.querySelector(`.workout[data-id="${id}"]`);
    workoutEl.classList.add('workout--hidden');
  }
  /*
  _showWorkoutEl(id) {
    const workoutEl = document.querySelector(`.workout[data-id="${id}"]`);
    // update workout ui
    // this._renderWorkout(this.#workouts.find(work => work.id === id));
    workoutEl.classList.remove('workout--hidden');
  }
  */
  _fetchWorkout(id) {
    return this.#workouts.find(work => work.id === id);
  }
  _enableInputType() {
    inputType.disabled = '';
  }
  _disableInputType() {
    inputType.disabled = 'disabled';
  }
  _showUpdateForm(id) {
    // fetch workout
    const workout = this._fetchWorkout(id);
    // fill form with data
    inputType.value = workout.type;
    inputDistance.value = workout.distance;
    inputDuration.value = workout.duration;

    if (workout.type === 'running') {
      inputElevation.closest('.form__row').classList.add('form__row--hidden');
      inputCadence.closest('.form__row').classList.remove('form__row--hidden');
      inputCadence.value = workout.cadence;
    }
    if (workout.type === 'cycling') {
      inputCadence.closest('.form__row').classList.add('form__row--hidden');
      inputElevation
        .closest('.form__row')
        .classList.remove('form__row--hidden');
      inputElevation.value = workout.elevationGain;
    }
    // show form
    form.classList.remove('hidden');
    inputDistance.focus();
  }
  _handleWorkout(e) {
    e.preventDefault();
    const validInputs = (...inputs) =>
      inputs.every(input => Number.isFinite(input));

    const allPosiive = (...inputs) => inputs.every(input => input > 0);

    const updateWorkout = (workout, type, ...inputs) => {
      const distance = inputs[0];
      const duration = inputs[1];
      let newWorkout;

      if (type === 'running') {
        newWorkout = new Running(workout.coords, distance, duration, inputs[2]);
      }
      if (type === 'cycling') {
        newWorkout = new Cycling(workout.coords, distance, duration, inputs[2]);
      }
      // preserve date, id
      newWorkout.id = workout.id;
      newWorkout.date = workout.date;

      return newWorkout;
    };

    const replaceWorkout = (id, newWorkout) => {
      const index = this.#workouts.findIndex(work => work.id === id);
      this.#workouts[index] = newWorkout;
    };
    // Get data from form
    const type = inputType.value;
    const distance = +inputDistance.value;
    const duration = +inputDuration.value;
    let workout;
    let lat, lng;

    if (!this.#editing) {
      lat = this.#mapEvent.latlng.lat;
      lng = this.#mapEvent.latlng.lng;
    }

    // if workout running
    if (type === 'running') {
      const cadence = +inputCadence.value;
      // Check if data is valid
      if (
        !validInputs(distance, duration, cadence) ||
        !allPosiive(distance, duration, cadence)
      )
        return alert('Input has to be positive number');
      if (!this.#editing) {
        // new workout
        workout = new Running([lat, lng], distance, duration, cadence);
      } else {
        // update workout
        workout = this._fetchWorkout(this.#editingId);
        workout = updateWorkout(workout, type, distance, duration, cadence);
      }
    }
    // if workout cycling
    if (type === 'cycling') {
      const elevationGain = +inputElevation.value;
      // Check if data is valid
      if (
        !validInputs(distance, duration, elevationGain) ||
        !allPosiive(distance, duration)
      )
        return alert('Input has to be positive number');
      if (!this.#editing) {
        // new workout
        workout = new Cycling([lat, lng], distance, duration, elevationGain);
      } else {
        // update workout
        workout = this._fetchWorkout(this.#editingId);
        workout = updateWorkout(
          workout,
          type,
          distance,
          duration,
          elevationGain
        );
      }
    }
    if (!this.#editing) {
      // add new object to workout array
      this.#workouts.push(workout);
      // render workout marker on map
      this._renderWorkoutMarker(workout);
    }

    // render workout on list
    this._renderWorkout(workout);

    if (this.#editing) {
      // replace old workout with updated one
      replaceWorkout(this.#editingId, workout);
      // replace old map marker with new one
      // - delete old
      this._removeMarker(workout.id);
      // - create new
      this._renderWorkoutMarker(workout);
      // make workout element visible
      // this._showWorkoutEl(workout.id);
      // stop editing status
      this.#editing = false;
      this.#editingId = null;
    }

    // apply sort filter, if any
    if (this.#activeFilter) {
      // sort
      this._sortByFilter(this.#activeFilter);
      // re-render all workouts on list (sorted)
      this._reRenderAllWorkoutEl(workout.id);
    }
    // hide form
    this._hideForm();
    // set local storage to all workouts
    this._setLocalStorage();
  }
  _workoutAdded(id) {
    // Fetch workout element
    const workout = document.querySelector(`.workout[data-id="${id}"]`);
    // add edited style to workout element
    workout.classList.add('workout--edited');
    // remove edited style after sometime
    setTimeout(function () {
      workout.classList.remove('workout--edited');
    }, this.#editedDuration);
  }
  _reRenderAllWorkoutEl(highlightId = null) {
    this._removeAllWorkoutEl();
    this._renderAllWorkouts(highlightId);
  }
  // Delete
  _removeWorkout(id) {
    const index = this.#workouts.findIndex(work => work.id === id);
    // remove marker
    this._removeMarker(id);
    // remove workout from UI
    this._removeWorkoutEl(id);
    // remove workout from array
    this.#workouts.splice(index, 1);
    // Update local storage
    this._setLocalStorage();
  }
  _removeMarker(parentId) {
    const marker = this.#markers.find(marker => marker.parentId === parentId);
    // delete map marker
    marker.marker.remove();
    const markerIndex = this.#markers.indexOf(marker);
    // remove marker from app state array
    this.#markers.splice(markerIndex, 1);
  }
  _removeWorkoutEl(id) {
    // add deleting class to workout element
    const workoutEl = document.querySelector(`.workout[data-id="${id}"]`);
    workoutEl.classList.add('workout--deleting');
    // set timeout delete workout el
    setTimeout(function () {
      workoutEl.remove();
    }, this.#deleteDuration);
  }
  _removeAllWorkoutEl() {
    this.#workouts.forEach(workout => {
      const workoutEl = document.querySelector(
        `.workout[data-id="${workout.id}"]`
      );
      workoutEl.remove();
    });
  }
  // Delete all
  _removeAllWorkouts() {
    // remove all workouts
    // METHOD #1
    // can't mutate/modify the array which we are iterating (unexpected results), so iterating over copy
    this.#workouts.slice().forEach(workout => this._removeWorkout(workout.id));
    /*
    // METHOD #2
    this.#workouts.forEach(workout => {
      // remove markers
      this._removeMarker(workout.id);
      // remove UI el
      this._removeWorkoutEl(workout.id);
    });
    // remove from array
    this.#workouts.splice(0);
    */
  }
  // Sort / Filter
  // - helpers
  _getFilterStatusReference(filter) {
    if (filter === 'distance') {
      return this.#sortDistanceStatus;
    }
    // Duration
    if (filter === 'duration') {
      return this.#sortDurationStatus;
    }
  }
  _changeSortStatus(filter) {
    const sortStatus = this._getFilterStatusReference(filter);
    // change state / status
    if (sortStatus.status !== 0 && !sortStatus.status) {
      // console.log('is null, changing to ascending');
      sortStatus.status = 0;
    } else if (sortStatus.status === 0) {
      // console.log('is ascending, changing to descending');
      sortStatus.status = 1;
    } else if (sortStatus.status === 1) {
      // console.log('is descending, changing to null');
      sortStatus.status = null;
      // reset active filter
      this.#activeFilter = null;
    }
    // Update sort status in UI
    this._updateSortStatusUI(filter);
  }
  _resetSortStatus(filter) {
    const sortStatus = this._getFilterStatusReference(filter);
    sortStatus.status = null;
    this._updateSortStatusUI(filter);
  }
  // - By date added
  _sortByDefault() {
    // -- Ascending (default)
    this.#workouts.sort((a, b) => a.id - b.id);
  }
  _handleSortByFilter(filter) {
    // assign active filter
    this.#activeFilter = filter;
    // reset rest of the filter(s) status
    if (filter === 'distance') {
      this._resetSortStatus('duration');
    }
    if (filter === 'duration') {
      this._resetSortStatus('distance');
    }
    // change status in code and in UI
    this._changeSortStatus(filter);
    const sortStatus = this._getFilterStatusReference(filter);
    // sort based on status
    if (sortStatus.status === null) {
      // default
      this._sortByDefault();
    } else {
      // sort by filter
      this._sortByFilter(filter);
    }
    this._reRenderAllWorkoutEl();
  }
  _sortByFilter(filter) {
    // Implements ascending or descending
    const sortStatus = this._getFilterStatusReference(filter);
    if (sortStatus.status === 0) {
      this.#workouts.sort((a, b) => b[filter] - a[filter]);
    } else if (sortStatus.status === 1) {
      this.#workouts.sort((a, b) => a[filter] - b[filter]);
    }
  }
  _updateSortStatusUI(filter) {
    let sortStatusEl;
    const sortStatus = this._getFilterStatusReference(filter);
    if (filter === 'distance') {
      sortStatusEl = sortDistanceStatusEl;
    }
    if (filter === 'duration') {
      sortStatusEl = sortDurationStatusEl;
    }
    switch (sortStatus.status) {
      case null:
        sortStatusEl.classList.remove('fa-sort-up');
        sortStatusEl.classList.remove('fa-sort-down');
        sortStatusEl.classList.add('fa-sort');
        break;
      case 0:
        sortStatusEl.classList.add('fa-sort-up');
        sortStatusEl.classList.remove('fa-sort-down');
        sortStatusEl.classList.remove('fa-sort');
        break;
      case 1:
        sortStatusEl.classList.add('fa-sort-down');
        sortStatusEl.classList.remove('fa-sort-up');
        sortStatusEl.classList.remove('fa-sort');
        break;
      default:
        break;
    }
  }
  reset() {
    localStorage.removeItem('workouts');
    location.reload();
  }
}

const app = new App();
