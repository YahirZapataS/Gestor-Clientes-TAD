// reports.js
import { db } from "./firebaseConfig.js";
import {
    collection,
    getDocs,
    query,
    where,
    orderBy,
    Timestamp,
    doc,
    getDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const totalCreditUsed = document.getElementById("totalCreditUsed");
const fetchClientReportBtn = document.getElementById("fetchClientReportBtn");
const clientIdInput = document.getElementById("clientIdInput");
const clientReportResult = document.getElementById("clientReportResult");
const loadPaymentsBtn = document.getElementById("loadPaymentsBtn");
const paymentsList = document.getElementById("paymentsList");

let currentClientHistory = [];
let currentClientData = null;

// 1. Reporte de crédito total en uso
async function calculateTotalCreditUsed() {
    const clientsSnap = await getDocs(collection(db, "clients"));
    let total = 0;
    clientsSnap.forEach(doc => {
        total += doc.data().currentDebt || 0;
    });
    totalCreditUsed.textContent = `$${total.toFixed(2)}`;
}

// 2. Historial de cliente: notas de crédito y pagos
async function fetchClientHistory(clientId) {
    clientReportResult.innerHTML = "Cargando...";
    let html = "";
    currentClientHistory = [];

    // Obtener datos del cliente
    const clientDocSnap = await getDoc(query(doc(db, "clients", `${clientId}`)));
    if (!clientDocSnap.exists()) {
        clientReportResult.innerHTML = `<p>Cliente no encontrado.</p>`;
        return;
    }
    currentClientData = clientDocSnap.data();
    const name = currentClientData.name;
    const debt = currentClientData.currentDebt || 0;

    // Mostrar encabezado en la interfaz
    html += `<h4 id="clientNameHeader">${name}</h4>`;
    html += `<p>ID: <span id="clientIdHeader">${clientId}</span></p>`;
    html += `<p>Crédito activo: <span id="clientDebtHeader">$${debt.toFixed(2)}</span></p>`;

    // Obtener créditos del cliente
    const creditsSnap = await getDocs(query(
        collection(db, "credits"),
        where("clientId", "==", clientId)
    ));

    html += `<h4>Notas de Crédito</h4>`;
    if (creditsSnap.empty) {
        html += `<p>No hay notas encontradas.</p>`;
    } else {
        creditsSnap.forEach(doc => {
            const data = doc.data();
            const fecha = data.date instanceof Timestamp
                ? data.date.toDate().toLocaleString("es-MX", { dateStyle: "medium", timeStyle: "short" })
                : new Date().toLocaleString("es-MX", { dateStyle: "medium", timeStyle: "short" });
            const productos = data.productos.map(p =>
                `${p.name} x${p.qty} - $${p.price.toFixed(2)}`).join(", ");
            const total = data.productos.reduce((acc, p) => acc + (p.price * p.qty), 0);
            currentClientHistory.push({ fecha, tipo: "Crédito", detalle: productos, total: `$${total.toFixed(2)}` });
            html += `<div class="noteBox">
        <p><strong>Fecha:</strong> ${fecha}</p>
        <p>${productos}</p>
        <p><strong>Total:</strong> $${total.toFixed(2)}</p>
      </div>`;
        });
    }

    // Obtener pagos del cliente
    const paymentsSnap = await getDocs(query(
        collection(db, "payments"),
        where("clientId", "==", clientId)
    ));

    html += `<h4>Pagos</h4>`;
    if (paymentsSnap.empty) {
        html += `<p>No hay pagos encontrados.</p>`;
    } else {
        paymentsSnap.forEach(doc => {
            const data = doc.data();
            const fecha = data.date instanceof Timestamp
                ? data.date.toDate().toLocaleString("es-MX", { dateStyle: "medium", timeStyle: "short" })
                : new Date().toLocaleString("es-MX", { dateStyle: "medium", timeStyle: "short" });
            const metodo = data.method || "-";
            currentClientHistory.push({ fecha, tipo: "Pago", detalle: metodo, total: `$${data.amount.toFixed(2)}` });
            html += `<div class="noteBox">
        <p><strong>Fecha:</strong> ${fecha}</p>
        <p><strong>Monto:</strong> $${data.amount.toFixed(2)}</p>
        <p><strong>Método:</strong> ${metodo}</p>
      </div>`;
        });
    }

    html += `<button id="exportClientPDF" class="btnExport">Exportar historial PDF</button>`;
    clientReportResult.innerHTML = html;

    // Agregar evento al boton exportar
    document.getElementById("exportClientPDF").addEventListener("click", exportClientHistoryToPDF);
}

function exportClientHistoryToPDF() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    const clientName = document.getElementById("clientNameHeader")?.textContent || "Cliente";
    const clientId = parseInt(clientIdInput.value) || "-";
    const clientDebt = document.getElementById("clientDebtHeader")?.textContent || "$0.00";

    doc.setFontSize(14);
    doc.text("Historial del Cliente", 14, 20);

    doc.setFontSize(10);
    doc.text(`Nombre: ${clientName}`, 14, 28);
    doc.text(`ID: ${clientId}`, 14, 34);
    doc.text(`Crédito activo: ${clientDebt}`, 14, 40);

    doc.autoTable({
        startY: 48,
        head: [["Fecha", "Tipo", "Detalle", "Total"]],
        body: currentClientHistory.map(r => [r.fecha, r.tipo, r.detalle, r.total]),
        styles: { fontSize: 9, cellPadding: 2 },
        headStyles: { fillColor: [34, 122, 158] }
    });

    doc.save(`historial_cliente_${clientName}.pdf`);
}

// 3. Reporte de todos los pagos realizados
async function loadAllPayments() {
    paymentsList.innerHTML = "Cargando...";
    let html = "";

    const paymentsSnap = await getDocs(query(
        collection(db, "payments"),
        orderBy("date", "desc")
    ));

    if (paymentsSnap.empty) {
        html = `<p>No hay pagos registrados.</p>`;
    } else {
        paymentsSnap.forEach(doc => {
            const data = doc.data();
            const fecha = data.date instanceof Timestamp
                ? data.date.toDate().toLocaleString("es-MX", { dateStyle: "medium", timeStyle: "short" })
                : new Date().toLocaleString("es-MX", { dateStyle: "medium", timeStyle: "short" });
            html += `<div class="noteBox">
        <p><strong>Cliente ID:</strong> ${data.clientId}</p>
        <p><strong>Fecha:</strong> ${fecha}</p>
        <p><strong>Monto:</strong> $${data.amount.toFixed(2)}</p>
        <p><strong>Método:</strong> ${data.method}</p>
      </div>`;
        });
    }
    paymentsList.innerHTML = html;
}

// Eventos
fetchClientReportBtn.addEventListener("click", () => {
    const id = parseInt(clientIdInput.value);
    if (!isNaN(id)) fetchClientHistory(id);
});

loadPaymentsBtn.addEventListener("click", loadAllPayments);

// Inicial
calculateTotalCreditUsed();



const style = document.createElement('style');
style.textContent = `
  .reportSection {
    margin: 20px 0;
    padding: 15px;
    border: 1px solid #ddd;
    border-radius: 10px;
    background-color: #fafafa;
  }

  .reportSection h3 {
    margin-bottom: 10px;
    font-size: 1.2rem;
    color: #333;
  }

  #totalCreditUsed {
    font-size: 1.5rem;
    font-weight: bold;
    color: #2c3e50;
  }

  .noteBox {
    border: 1px solid #ccc;
    padding: 10px;
    border-radius: 8px;
    margin-bottom: 12px;
    background-color: #fff;
  }

  .noteBox p {
    margin: 4px 0;
    font-size: 0.95rem;
  }

  button {
    padding: 10px 14px;
    margin-top: 6px;
    background-color: #2c3e50;
    color: white;
    border: none;
    border-radius: 6px;
    cursor: pointer;
  }

  input[type="number"] {
    padding: 8px;
    border: 1px solid #ccc;
    border-radius: 6px;
    margin-right: 8px;
    width: 120px;
  }
`;
document.head.appendChild(style);