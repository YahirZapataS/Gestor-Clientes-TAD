import { db } from "./firebaseConfig.js";
import {
    collection, doc, getDoc, getDocs, query, where, updateDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// Obtener ID desde la URL
const params = new URLSearchParams(window.location.search);
const clientId = params.get("id");

const clientNameEl = document.getElementById("clientName");
const creditInfoEl = document.getElementById("creditInfo");
const tableBody = document.getElementById("recordsTableBody");
const totalAmountEl = document.getElementById("totalAmount");
const payCashBtn = document.getElementById("payCashBtn");
const payTransferBtn = document.getElementById("payTransferBtn");

let currentClient = null;

if (!clientId) {
    Swal.fire("Error", "No se proporcionó ID de cliente", "error");
    throw new Error("Falta ID");
}

async function loadClientAccount() {
    try {
        const clientSnap = await getDoc(doc(db, "clients", clientId));
        if (!clientSnap.exists()) {
            Swal.fire("Error", "Cliente no encontrado", "error");
            return;
        }

        const client = clientSnap.data();
        currentClient = client; // Guardamos cliente
        clientNameEl.textContent = `Cuenta de ${client.name}`;
        creditInfoEl.textContent = `Crédito usado: $${client.currentDebt} / Límite: $${client.creditLimit}`;

        // 2. Obtener registros del cliente
        const q = query(collection(db, "creditRecords"), where("clientId", "==", Number(clientId)));
        const snapshot = await getDocs(q);

        let total = 0;
        snapshot.forEach(doc => {
            const record = doc.data();
            const date = new Date(record.date.seconds * 1000).toLocaleDateString();

            record.items.forEach(item => {
                const row = document.createElement("tr");
                row.innerHTML = `
          <td>${item.name}</td>
          <td>$${item.price}</td>
          <td>${item.quantity}</td>
          <td>$${item.price * item.quantity}</td>
          <td>${date}</td>
        `;
                tableBody.appendChild(row);
                total += item.price * item.quantity;
            });
        });

        totalAmountEl.textContent = `Total de la cuenta: $${total}`;

        async function handlePayment(method) {
            if (!currentClient || currentClient.currentDebt === 0) {
                Swal.fire("Aviso", "Este cliente no tiene deuda pendiente", "info");
                return;
            }

            const result = await Swal.fire({
                title: `¿Confirmar pago por ${method}?`,
                text: `Monto: $${currentClient.currentDebt}`,
                icon: "question",
                showCancelButton: true,
                confirmButtonText: "Confirmar"
            });

            if (result.isConfirmed) {
                try {
                    // 1. Actualizar cliente
                    const clientRef = doc(db, "clients", clientId);
                    await updateDoc(clientRef, { currentDebt: 0 });

                    // 2. Registrar pago
                    await addDoc(collection(db, "payments"), {
                        clientId: currentClient.id,
                        clientName: currentClient.name,
                        amount: currentClient.currentDebt,
                        method,
                        date: new Date()
                    });

                    // 3. Mensaje de éxito
                    Swal.fire("Pago registrado", `Pago por ${method} exitoso`, "success")
                        .then(() => location.reload());
                } catch (error) {
                    console.error(error);
                    Swal.fire("Error", "No se pudo registrar el pago", "error");
                }
            }
        }

        payCashBtn.addEventListener("click", () => handlePayment("efectivo"));
        payTransferBtn.addEventListener("click", () => handlePayment("transferencia"));

    } catch (error) {
        console.error(error);
        Swal.fire("Error", "Ocurrió un problema al cargar la cuenta", "error");
    }
}

loadClientAccount();
