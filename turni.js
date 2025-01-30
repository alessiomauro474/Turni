function convertToMinutes(time) {
    const [hours, minutes] = time.split(':').map(Number);
    return hours * 60 + minutes;
}

const weekDays = ["Lunedì", "Martedì", "Mercoledì", "Giovedì", "Venerdì", "Sabato", "Domenica"];
const workers = ["Mario", "Luigi", "Anna", "Giulia", "Paolo", "Carlo"];
let lastAssignedIndex = -1;
let shifts = [];

function fetchShifts() {
    const token = localStorage.getItem("token");
    if (!token) {
        console.error("Token non trovato! L'utente deve effettuare il login.");
        return;
    }

    console.log("Chiamata API avviata...");
    fetch("https://dev-imed.posytron.it/api/house-operator/v1/shift", {
        method: "GET",
        headers: {
            "Authorization": `Bearer ${token}`,
            "Content-Type": "application/json"
        }
    })
    .then(response => {
        console.log("HTTP Status:", response.status);
        if (!response.ok) {
            throw new Error(`Errore HTTP! Stato: ${response.status}, Testo: ${response.statusText}`);
        }
        return response.json();
    })
    .then(data => {
        if (data && Array.isArray(data)) {
            console.log("Dati ricevuti:", data);
            shifts = data;  
            renderShifts();  
        } else {
            console.error("Dati non validi ricevuti dall'API.");
        }
    })
    .catch(error => console.error("Errore nella richiesta:", error));
}

document.addEventListener("DOMContentLoaded", fetchShifts);

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
        body: JSON.stringify({
            start_time: shift.start,  
            end_time: shift.end,      
            day: shift.day,
            date: shift.date.toISOString().split("T")[0], 
            worker: shift.worker
        })
    })
    .then(response => {
        console.log("HTTP Status:", response.status);
        return response.json();
    })
    .then(data => {
        console.log("Turno inviato con successo:", data);
    })
    .catch(error => console.error("Errore nell'invio del turno:", error));
}

function getNextDay(currentDay) {
    const index = weekDays.indexOf(currentDay);
    return index !== -1 ? weekDays[(index + 1) % weekDays.length] : currentDay;
}

function isOverlapping(newStart, newEnd, newDay, newDate) {
    return shifts.some(shift => 
        shift.day === newDay &&
        new Date(shift.date).getTime() === newDate.getTime() &&
        (
            (newStart >= shift.start && newStart < shift.end) || 
            (newEnd > shift.start && newEnd <= shift.end) || 
            (newStart <= shift.start && newEnd >= shift.end)
        )
    );
}

function getNextWorker(lastAssignedWorker, assignedDay) {
    let currentIndex = workers.indexOf(lastAssignedWorker);
    let nextWorkerIndex = (currentIndex + 1) % workers.length;

    let workerAssignedThisWeek = shifts.find(shift => shift.worker === workers[nextWorkerIndex] && shift.day === assignedDay);
    if (workerAssignedThisWeek) {
        nextWorkerIndex = (nextWorkerIndex + 1) % workers.length;
    }

    return workers[nextWorkerIndex];
}

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

    const start = convertToMinutes(startTime);
    const end = convertToMinutes(endTime);

    if (start >= end) {
        showError("L'orario di inizio deve essere prima dell'orario di fine.");
        return;
    }
    if (end - start > 360) { 
        showError("Il turno non può durare più di 6 ore.");
        return;
    }

    const selectedDayFromDate = getDayFromDate(date);
    if (selectedDayFromDate !== day) {
        showError(`La data selezionata (${date}) non corrisponde al giorno della settimana (${day}).`);
        return;
    }

    const shiftDate = new Date(Date.parse(date));

    if (isOverlapping(start, end, day, shiftDate)) {
        showError("Il turno si sovrappone a un altro turno esistente.");
        return;
    }

    let lastAssignedWorker = shifts.length > 0 ? shifts[shifts.length - 1].worker : null;
    const assignedWorker = getNextWorker(lastAssignedWorker, day);

    shifts.push({ start, end, day, date: shiftDate, worker: assignedWorker });
    renderShifts();
}

document.getElementById("shift-date").addEventListener("change", function() {
    const date = new Date(this.value);  // Ottieni la data selezionata
    const daysOfWeek = ["Domenica", "Lunedì", "Martedì", "Mercoledì", "Giovedì", "Venerdì", "Sabato"];
    
    const dayOfWeek = daysOfWeek[date.getDay()]; 
    document.getElementById("day").value = dayOfWeek;
});

function renderShifts() {
    const shiftList = document.getElementById('shift-list');
    shiftList.innerHTML = '';

    shifts.forEach(shift => {
        const listItem = document.createElement('li');
        const shiftDate = new Date(shift.date).toLocaleDateString(); 
        listItem.textContent = `Giorno: ${shift.day}, Data: ${shiftDate}, Inizio: ${formatTime(shift.start)}, Fine: ${formatTime(shift.end)}, Lavoratore: ${shift.worker}`;
        shiftList.appendChild(listItem);
    });

    filterShifts();
}

function formatTime(minutes) {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
}

function showError(message) {
    const errorNotification = document.getElementById('error-notification');
    const errorMessage = document.getElementById('error-message');

    errorMessage.textContent = message;
    errorNotification.style.display = 'block';
    errorNotification.classList.add('show');

    setTimeout(() => {
        errorNotification.style.display = 'none';
        errorNotification.classList.remove('show');
    }, 5000);
}

function getDayFromDate(dateString) {
    const date = new Date(Date.parse(dateString));
    const daysOfWeek = ["Domenica", "Lunedì", "Martedì", "Mercoledì", "Giovedì", "Venerdì", "Sabato"];
    return daysOfWeek[date.getDay()];
}

function updateDayFromDate() {
    const dateInput = document.getElementById('shift-date');
    const daySelect = document.getElementById('day');

    if (dateInput && daySelect) {
        dateInput.addEventListener('change', () => {
            const selectedDate = dateInput.value;
            const dayFromDate = getDayFromDate(selectedDate);
            daySelect.value = dayFromDate;
        });
    }
}
