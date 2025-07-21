import { db } from "./firebaseConfig.js";
import {
    collection, doc, getDoc, getDocs, query, where, updateDoc, addDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import {
    getStorage, ref, uploadBytes, getDownloadURL
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js";

// Obtener ID desde la URL
const params = new URLSearchParams(window.location.search);
const clientId = params.get("id");

const clientNameEl = document.getElementById("clientName");
const creditInfoEl = document.getElementById("creditInfo");
const tableBody = document.getElementById("recordsTableBody");
const totalAmountEl = document.getElementById("totalAmount");
const payCashBtn = document.getElementById("payCashBtn");
const payTransferBtn = document.getElementById("payTransferBtn");
const storage = getStorage();

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

        totalAmountEl.textContent = `Total de la cuenta: $${client.currentDebt}`;

        async function handlePayment(method) {
            if (!currentClient || currentClient.currentDebt === 0) {
                Swal.fire("Aviso", "Este cliente no tiene deuda pendiente", "info");
                return;
            }

            if (method === "efectivo") {
                const { value: amount } = await Swal.fire({
                    title: "Pago en efectivo",
                    html: `
                            <label for="paymentAmount">Cantidad a pagar:</label>
                            <input type="number" id="paymentAmount" class="swal2-input" min="1" placeholder="Ej. 100" />
                            <button id="payFullBtn" style="margin-top:10px; padding: 8px 12px; background-color: #27ae60; color:white; border:none; border-radius:6px; cursor:pointer;">
                            Pagar todo ($${currentClient.currentDebt})
                            </button>
                        `,
                    focusConfirm: false,
                    preConfirm: () => {
                        const inputVal = parseFloat(document.getElementById("paymentAmount").value);
                        if (!inputVal || inputVal <= 0) {
                            Swal.showValidationMessage("Ingresa una cantidad válida");
                        } else if (inputVal > currentClient.currentDebt) {
                            Swal.showValidationMessage("No puedes pagar más de la deuda actual");
                        } else {
                            return inputVal;
                        }
                    },
                    didOpen: () => {
                        const btn = document.getElementById("payFullBtn");
                        btn.addEventListener("click", () => {
                            Swal.close();
                            processPayment(currentClient.currentDebt, "efectivo");
                        });
                    },
                    confirmButtonText: "Confirmar pago parcial",
                    showCancelButton: true
                });

                if (amount) {
                    processPayment(amount, "efectivo");
                }

            } else if (method === "transferencia") {
                const { value: formValues } = await Swal.fire({
                    title: "Pago por transferencia",
                    html: `
      <label>Monto a transferir:</label>
      <input type="number" id="transferAmount" class="swal2-input" placeholder="Ej. 100" min="1" />

      <label style="margin-top:10px;">Comprobante:</label>
      <input type="file" id="transferFile" class="swal2-file" accept="image/*" style="margin-top: 10px;" />
    `,
                    focusConfirm: false,
                    preConfirm: () => {
                        const amount = parseFloat(document.getElementById("transferAmount").value);
                        const file = document.getElementById("transferFile").files[0];

                        if (!amount || amount <= 0 || amount > currentClient.currentDebt) {
                            Swal.showValidationMessage("Monto inválido o mayor al adeudo");
                            return false;
                        }

                        if (!file) {
                            Swal.showValidationMessage("Debes subir un comprobante");
                            return false;
                        }

                        return { amount, file };
                    },
                    confirmButtonText: "Confirmar transferencia",
                    showCancelButton: true
                });

                if (formValues) {
                    const { amount, file } = formValues;
                    await processTransferWithFile(amount, file);
                }
            }
        }

        async function processPayment(amount, method) {
            try {
                const newDebt = currentClient.currentDebt - amount;

                // 1. Actualizar cliente
                const clientRef = doc(db, "clients", clientId);
                await updateDoc(clientRef, { currentDebt: newDebt });

                // 2. Registrar pago
                await addDoc(collection(db, "payments"), {
                    clientId: currentClient.id,
                    clientName: currentClient.name,
                    amount,
                    method,
                    date: new Date()
                });

                const msg = newDebt === 0 ? "Deuda saldada" : `Pago registrado por $${amount}`;
                Swal.fire("Pago exitoso", msg, "success").then(() => location.reload());

            } catch (error) {
                console.error(error);
                Swal.fire("Error", "No se pudo registrar el pago", "error");
            }
        }

        async function processTransferWithFile(amount, file) {
            const overlay = document.getElementById("loadingOverlay");
            try {
                overlay.style.display = "flex";

                // 1. Subir imagen a Storage
                const fileName = `comprobantes/${currentClient.id}_${Date.now()}`;
                const fileRef = ref(storage, fileName);
                await uploadBytes(fileRef, file);
                const fileURL = await getDownloadURL(fileRef);

                // 2. Actualizar deuda
                const newDebt = currentClient.currentDebt - amount;
                const clientRef = doc(db, "clients", clientId);
                await updateDoc(clientRef, { currentDebt: newDebt });

                // 3. Registrar pago
                await addDoc(collection(db, "payments"), {
                    clientId: currentClient.id,
                    clientName: currentClient.name,
                    amount,
                    method: "transferencia",
                    comprobanteURL: fileURL,
                    date: new Date()
                });

                overlay.style.display = "none";
                Swal.fire("Transferencia registrada", "Pago aplicado correctamente", "success")
                    .then(() => location.reload());

            } catch (error) {
                overlay.style.display = "none";
                console.error(error);
                Swal.fire("Error", "No se pudo procesar el pago", "error");
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
