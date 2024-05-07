'use strict';

class Workout {
  date = new Date();
  id = (Date.now() + '').slice(-10);
  clicks = 0;
  marker = null;

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
const sortSelectEl = document.querySelector('#sort');

class App {
  #map;
  #mapEvent;
  #workouts = [];
  #mapZoomLevel = 13;
  #editing = false;
  #editingId;
  #deleteDuration = 500;
  #editedDuration = 2000;

  constructor() {
    this._getPosition();

    // Get data from local storage
    this._getLocalStorage();

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
    sortSelectEl.addEventListener('change', this._sortWorkouts.bind(this));
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
    workout.marker = marker;
  }
  _renderWorkout(workout) {
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
    this._workoutAdded(workout.id);
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

    this.#workouts = data;

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
  _showWorkoutEl(id) {
    const workoutEl = document.querySelector(`.workout[data-id="${id}"]`);
    // update workout ui
    // this._renderWorkout(this.#workouts.find(work => work.id === id));
    workoutEl.classList.remove('workout--hidden');
  }
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
      // preserve date, id and marker
      newWorkout.id = workout.id;
      newWorkout.date = workout.date;
      newWorkout.marker = workout.marker;

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
    const { lat, lng } = this.#mapEvent.latlng;
    let workout;

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
      // render workout on map
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
      this._showWorkoutEl(workout.id);
      // stop editing status
      this.#editing = false;
      this.#editingId = null;
    }
    // hide form
    this._hideForm();
    // set local storage to all workouts
    // this._setLocalStorage();
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
  // Delete
  _removeWorkout(id) {
    const index = this.#workouts.findIndex(work => work.id === id);
    // remove marker
    this._removeMarker(id);
    // remove workout from array
    this.#workouts.splice(index, 1);
    // add deleting class to workout element
    const workoutEl = document.querySelector(`.workout[data-id="${id}"]`);
    workoutEl.classList.add('workout--deleting');
    // set timeout delete workout el
    setTimeout(function () {
      workoutEl.remove();
    }, this.#deleteDuration);
  }
  _removeMarker(id) {
    const workout = this.#workouts.find(work => work.id === id);
    // delete map marker
    workout.marker.remove();
  }
  _removeAllWorkoutEl() {
    this.#workouts.forEach(workout => {
      const workoutEl = document.querySelector(
        `.workout[data-id="${workout.id}"]`
      );
      workoutEl.remove();
    });
  }
  // Sort / Filter
  _sortWorkouts() {
    const type = sortSelectEl.value;
    if (!type) {
      // Render original workouts
      // - remove all workout el
      this._removeAllWorkoutEl();
      // - add all new workout el
      this.#workouts.forEach(workout => {
        this._renderWorkout(workout);
      });
    } else {
      const cyclingWorkouts = this.#workouts.filter(
        work => work.type === 'cycling'
      );
      const runningWorkouts = this.#workouts.filter(
        work => work.type === 'running'
      );
      let sortedWorkouts;

      if (type === 'running') {
        sortedWorkouts = [...cyclingWorkouts, ...runningWorkouts];
      }
      if (type === 'cycling') {
        sortedWorkouts = [...runningWorkouts, ...cyclingWorkouts];
      }
      // Render
      // - remove all workout el
      this._removeAllWorkoutEl();
      // - add all new workout el
      sortedWorkouts.forEach(workout => {
        this._renderWorkout(workout);
      });
    }
  }
  reset() {
    localStorage.removeItem('workouts');
    location.reload();
  }
}

const app = new App();