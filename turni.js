let shifts = [];

// Converte l'orario in minuti (utile per calcoli aggiuntivi)
function convertToMinutes(time) {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

// Aggiunge un turno (POST request)
function addShift(event) {
  event.preventDefault();

  const startTime = document.getElementById('start-time').value;
  const endTime = document.getElementById('end-time').value;
  const day = document.getElementById('day').value;
  const date = document.getElementById('shift-date').value;

  if (!startTime || !endTime || !day || !date) {
    showError("Tutti i campi devono essere compilati.");
    return;
  }

  const today = new Date();
  const selectedDate = new Date(date);
  if (selectedDate < today.setHours(0, 0, 0, 0)) {
    showError("Non è possibile scegliere un giorno già passato.");
    return;
  }

  const start = new Date(`${date}T${startTime}:00`).getTime();
  const end = new Date(`${date}T${endTime}:00`).getTime();

  if (start >= end) {
    showError("L'orario di inizio deve essere prima dell'orario di fine.");
    return;
  }
  if ((end - start) / (1000 * 60) > 360) {
    showError("Il turno non può durare più di 6 ore.");
    return;
  }

  if (isOverlapping(start, end, day, date)) {
    showError("Il turno si sovrappone a un altro turno esistente.");
    return;
  }

  let assignedWorker = getNextWorker();
  const shift = {
    start_date: new Date(start).toISOString(),
    end_date: new Date(end).toISOString(),
    day,
    date,
    worker: assignedWorker
  };

  sendShift(shift);
  shifts.push(shift);
  renderShifts();
}

// Invia il turno all'API
function sendShift(shift) {
  const token = localStorage.getItem("token");
  if (!token) {
    console.error("Token non trovato! L'utente deve effettuare il login.");
    return;
  }

  fetch("https://dev-imed.posytron.it/api/house-operator/v1/shift", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ shifts: [{ start_date: shift.start_date, end_date: shift.end_date, day: shift.day }] })
  })
    .then(response => response.ok ? response.json() : response.text().then(text => { throw new Error(text); }))
    .then(data => {
      console.log("Risposta dell'API:", data);
      alert("Turno inviato correttamente!"); 
      // Qui puoi richiamare getShifts() se vuoi aggiornare la lista
    })
    .catch(error => console.error("Errore nell'invio del turno:", error));
}

// Recupera i turni dall'API
async function getShifts() {
  const token = localStorage.getItem("token");
  if (!token) {
    console.error("Token non trovato! L'utente deve effettuare il login.");
    return;
  }

  try {
    const response = await fetch("https://dev-imed.posytron.it/api/house-operator/v1/shift", {
      method: "GET",
      headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" }
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Errore HTTP ${response.status}: ${text}`);
    }

    const data = await response.json();
    shifts = data.data.map((item, index) => ({
      start_date: new Date(item.start_date).toISOString(),
      end_date: new Date(item.end_date).toISOString(),
      date: item.start_date.split(" ")[0],
      day: new Date(item.start_date).toLocaleString('it-IT', { weekday: 'long' }),
      // Qui usiamo l'indice per assegnare ciclicamente il lavoratore
      worker: item.worker || getNextWorker(index)
    }));
    
    renderShifts();
  } catch (error) {
    console.error("Errore durante il recupero dei turni:", error);
  }
}

// Mostra i turni nell'interfaccia
// Se non viene passato un array filtrato, usa la variabile globale "shifts"
function renderShifts(filteredShifts) {
  const list = filteredShifts || shifts;
  const shiftList = document.getElementById('shift-list');
  if(list.length === 0) {
    shiftList.innerHTML = "<li>Nessun turno trovato</li>";
    return;
  }
  shiftList.innerHTML = list.map(shift => `
    <li>Giorno: ${shift.day}, Data: ${shift.date}, Inizio: ${formatTime(new Date(shift.start_date))}, Fine: ${formatTime(new Date(shift.end_date))}, Lavoratore: ${shift.worker}</li>
  `).join('');
}

// Formatta l'orario
function formatTime(dateObj) {
  return dateObj.toTimeString().split(' ')[0].substring(0, 5);
}

// Mostra errori
function showError(message) {
  const errorNotification = document.getElementById('error-notification');
  document.getElementById('error-message').textContent = message;
  errorNotification.style.display = 'block';
  setTimeout(() => errorNotification.style.display = 'none', 5000);
}

// Controlla sovrapposizioni
function isOverlapping(newStart, newEnd, newDay, newDate) {
  return shifts.some(shift => shift.date === newDate && (
    (newStart >= Date.parse(shift.start_date) && newStart < Date.parse(shift.end_date)) ||
    (newEnd > Date.parse(shift.start_date) && newEnd <= Date.parse(shift.end_date)) ||
    (newStart <= Date.parse(shift.start_date) && newEnd >= Date.parse(shift.end_date))
  ));
}

// Assegna lavoratore in maniera ciclica
function getNextWorker(index) {
  const workers = ["Mario", "Luigi", "Anna", "Giulia", "Paolo", "Carlo"];
  if (typeof index === "number") {
    return workers[index % workers.length];
  }
  return workers[shifts.length % workers.length];
}

// Associa eventi
document.getElementById("addShiftForm").addEventListener("submit", addShift);
document.addEventListener("DOMContentLoaded", getShifts);

// Blocco per il filtraggio
document.addEventListener("DOMContentLoaded", () => {
  const searchInput = document.getElementById("search");
  const workerSearchInput = document.getElementById("worker-search");
  const sortOrderSelect = document.getElementById("sort-order");

  if (!searchInput || !workerSearchInput || !sortOrderSelect) return;

  const filterShifts = () => {
    const dayFilter = searchInput.value.toLowerCase();
    const workerFilter = workerSearchInput.value.toLowerCase();
    const sortOrder = sortOrderSelect.value;

    let filteredShifts = shifts;

    if (dayFilter) {
      filteredShifts = filteredShifts.filter(shift =>
        shift.day.toLowerCase().includes(dayFilter)
      );
    }

    if (workerFilter) {
      filteredShifts = filteredShifts.filter(shift =>
        shift.worker.toLowerCase().includes(workerFilter)
      );
    }

    filteredShifts.sort((a, b) => {
      const dateA = new Date(a.date);
      const dateB = new Date(b.date);
      return sortOrder === "asc" ? dateA - dateB : dateB - dateA;
    });

    renderShifts(filteredShifts);
  };

  searchInput.addEventListener("input", filterShifts);
  workerSearchInput.addEventListener("input", filterShifts);
  sortOrderSelect.addEventListener("change", filterShifts);
});
