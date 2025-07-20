import { db } from "./firebaseConfig.js";
import {
    collection,
    getDocs,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const searchInput = document.getElementById("searchInput");
const searchResults = document.getElementById("searchResults");
const clientsRef = collection(db, "clients");

searchInput.addEventListener("input", async () => {
    const value = searchInput.value.trim().toLowerCase();
    searchResults.innerHTML = "";

    if (value.length === 0) return;

    const snapshot = await getDocs(clientsRef);

    const filtered = snapshot.docs.filter(doc => {
        const client = doc.data();
        return (
            client.name.toLowerCase().includes(value) ||
            String(client.id).includes(value)
        );
    });

    if (filtered.length === 0) {
        searchResults.innerHTML = `<p style="margin-top: 10px;">No se encontraron coincidencias</p>`;
        return;
    }

    filtered.forEach(doc => {
        const c = doc.data();
        const div = document.createElement("div");
        div.className = "client-card";
        div.innerHTML = `
      <div class="client-info">
        <span class="client-name">${c.name}</span>
        <span class="client-id">ID: ${c.id}</span>
        <span class="client-total-amount">Total: ${c.currentDebt}
      </div>
      <div class="client-actions">
        <button class="btn-edit" onclick="viewAccount(${c.id})">Ver Cuenta</button>
      </div>
    `;
        searchResults.appendChild(div);
    });
});

window.viewAccount = (id) => {
    // Redirige a la vista individual del cliente con su ID
    location.href = `client-account.html?id=${id}`;
};
