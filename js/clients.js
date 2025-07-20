// js/clients.js
import { db } from './firebaseConfig.js';
import {
    collection,
    addDoc,
    getDocs,
    query,
    orderBy
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const form = document.getElementById('clientForm');
const clientNameInput = document.getElementById('clientName');
const clientsList = document.getElementById('clientsList');
const clientsRef = collection(db, "clients");

// Mostrar todos los clientes
async function loadClients() {
    clientsList.innerHTML = '';
    const snapshot = await getDocs(query(clientsRef, orderBy("name")));
    snapshot.forEach(doc => {
        const data = doc.data();
        const li = document.createElement("li");
        li.textContent = `${data.name} - Debt: $${data.currentDebt}`;
        clientsList.appendChild(li);
    });
}

// Validar duplicados ignorando mayúsculas/minúsculas
async function clientExists(name) {
    const normalizedName = name.trim().toLowerCase();
    const snapshot = await getDocs(clientsRef);
    for (const doc of snapshot.docs) {
        if (doc.data().name.trim().toLowerCase() === normalizedName) {
            return true;
        }
    }
    return false;
}

// Evento al enviar el formulario
form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = clientNameInput.value.trim();

    if (!name) {
        alert("Please enter a valid name.");
        return;
    }

    const exists = await clientExists(name);
    if (exists) {
        alert("Client already exists.");
        return;
    }

    try {
        await addDoc(clientsRef, {
            name: name,
            creditLimit: 1000,
            currentDebt: 0
        });
        alert("Client added successfully.");
        clientNameInput.value = '';
        loadClients();
    } catch (error) {
        console.error("Error adding client:", error);
        alert("Failed to add client.");
    }
});

// Cargar clientes al iniciar
loadClients();