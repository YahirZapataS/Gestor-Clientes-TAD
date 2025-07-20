import { db } from "./firebaseConfig.js";
import {
    collection,
    getDocs,
    getDoc,
    query,
    where,
    doc,
    setDoc,
    deleteDoc,
    updateDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const clientForm = document.getElementById("clientForm");
const clientNameInput = document.getElementById("clientName");
const clientsList = document.getElementById("clientsList");
const clientsRef = collection(db, "clients");

clientForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const rawName = clientNameInput.value.trim();
    const name = rawName.toLowerCase();
    if (!name) return;

    try {
        // Validación de nombre duplicado (ignora mayúsculas)
        const clientsRef = collection(db, "clients");
        const q = query(clientsRef, where("nameLower", "==", name));
        const snapshot = await getDocs(q);
        if (!snapshot.empty) {
            Swal.fire("Upss!", "El cliente ya existe!", "warning");
            return;
        }

        // Leer último ID
        const counterRef = doc(db, "metadata", "clientsCounter");
        const counterSnap = await getDoc(counterRef);
        let lastId = 0;
        if (counterSnap.exists()) {
            lastId = counterSnap.data().lastId;
        }

        const newId = lastId + 1;
        const newClient = {
            id: newId,
            name: rawName,
            nameLower: name,
            creditLimit: 1000,
            currentDebt: 0,
            createdAt: new Date()
        };

        // Guardar cliente con ID numérico
        await setDoc(doc(db, "clients", String(newId)), newClient);

        // Actualizar contador
        await updateDoc(counterRef, { lastId: newId });

        Swal.fire("Todo bien", "Cliente agregado", "success");
        clientForm.reset();
        loadClients();
    } catch (error) {
        console.error("Error adding client:", error);
        Swal.fire("Error", "Algo a pasado, no hemos podido agregar al cliente", "error");
    }
});


async function loadClients() {
    clientsList.innerHTML = "";
    const snapshot = await getDocs(clientsRef);

    snapshot.forEach(doc => {
        const c = doc.data();
        const card = document.createElement("div");
        card.className = "client-card";
        card.innerHTML = `
      <div class="client-info">
        <span class="client-name">${c.name}</span>
        <span class="client-id">ID: ${c.id}</span>
      </div>
      <div class="client-actions">
        <button class="btn-edit" onclick="editClient('${c.id}', '${c.name}')">Edit</button>
        <button class="btn-delete" onclick="deleteClient('${c.id}', '${c.name}')">Delete</button>
      </div>
    `;
        clientsList.appendChild(card);
    });
}

// Agrega funciones al scope global
window.editClient = async (id, currentName) => {
    const { value: newName } = await Swal.fire({
        title: "Nombre nuevo",
        input: "text",
        inputValue: currentName,
        showCancelButton: true,
        confirmButtonText: "Actualizar"
    });

    if (newName && newName.trim() !== "") {
        const lowerName = newName.toLowerCase();

        // Verifica duplicado
        const q = query(clientsRef, where("nameLower", "==", lowerName));
        const snap = await getDocs(q);
        const duplicate = snap.docs.find(doc => doc.id !== id);

        if (duplicate) {
            return Swal.fire("Upss", "Otro cliente ya tiene este nombre", "warning");
        }

        await updateDoc(doc(db, "clients", id), {
            name: newName,
            nameLower: lowerName
        });

        Swal.fire("Listo!", "Cliente actualizado", "success");
        loadClients();
    }
};

window.deleteClient = async (id, name) => {
    const confirm = await Swal.fire({
        title: `Eliminar a ${name}?`,
        text: "Esta acción no puede deshacerse",
        icon: "warning",
        showCancelButton: true,
        confirmButtonText: "Sí, borrar"
    });

    if (confirm.isConfirmed) {
        await deleteDoc(doc(db, "clients", id));
        Swal.fire("Eliminado", "", "success");
        loadClients();
    }
};

loadClients();