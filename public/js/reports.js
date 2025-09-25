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
    getDoc,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const totalCreditUsed = document.getElementById("totalCreditUsed");
const clientSelect = document.getElementById("clientSelect");
const clientReportResult = document.getElementById("clientReportResult");
const exportGeneralBtn = document.getElementById("exportGeneralReport");

let currentClientHistory = [];
let currentClientData = null;
let clientsMap = new Map();
let currentProducts = [];
let currentPayments = [];

async function populateClientSelect() {
    const snap = await getDocs(query(collection(db, "clients"), orderBy("id")));

    snap.forEach((doc) => {
        const data = doc.data();
        const option = document.createElement("option");
        option.value = data.id;
        option.textContent = `${data.name} (ID: ${data.id})`;
        clientSelect.appendChild(option);
        clientsMap.set(data.id, data);
    });
}
clientSelect.addEventListener("change", () => {
    const clientId = clientSelect.value;
    if (clientId) {
        fetchClientHistory(clientId);
    }
});

async function calculateTotalCreditUsed() {
    const clientsSnap = await getDocs(collection(db, "clients"));
    let total = 0;
    clientsSnap.forEach((doc) => {
        total += doc.data().currentDebt || 0;
    });
    totalCreditUsed.textContent = `$${total.toFixed(2)}`;
}

async function fetchClientHistory(clientId) {
    clientReportResult.innerHTML = "Cargando...";
    let html = "";
    currentClientHistory = [];
    currentProducts = [];
    currentPayments = [];

    const clientDocSnap = await getDoc(query(doc(db, "clients", `${clientId}`)));
    if (!clientDocSnap.exists()) {
        clientReportResult.innerHTML = `<p>Cliente no encontrado.</p>`;
        return;
    }
    currentClientData = clientDocSnap.data();
    const name = currentClientData.name;
    const debt = currentClientData.currentDebt || 0;

    html += `<h4 id="clientNameHeader">${name}</h4>`;
    html += `<p>ID: <span id="clientIdHeader">${clientId}</span></p>`;
    html += `<p>Crédito activo: <span id="clientDebtHeader">$${debt.toFixed(
        2
    )}</span></p>`;

    const creditSnap = await getDocs(
        query(
            collection(db, "creditRecords"),
            where("clientId", "==", parseInt(clientId))
        )
    );

    if (!creditSnap.empty) {
        creditSnap.forEach((doc) => {
            const data = doc.data();
            const fecha =
                data.date instanceof Timestamp ? data.date.toDate() : new Date();
            const items = data.items || [];

            const productosTexto = items
                .map((p) => `${p.name} x${p.quantity} - $${p.price.toFixed(2)}`)
                .join(", ");

            const total = items.reduce((acc, p) => acc + p.price * p.quantity, 0);

            currentClientHistory.push({
                fecha,
                tipo: "Crédito",
                detalle: productosTexto,
                total: `$${total.toFixed(2)}`,
            });

            items.forEach((p) => {
                currentProducts.push({
                    fecha,
                    name: p.name,
                    quantity: p.quantity,
                    price: p.price,
                });
            });
        });
    }

    const paymentsSnap = await getDocs(
        query(
            collection(db, "payments"),
            where("clientId", "==", parseInt(clientId))
        )
    );

    if (!paymentsSnap.empty) {
        paymentsSnap.forEach((doc) => {
            const data = doc.data();
            const fecha =
                data.date instanceof Timestamp ? data.date.toDate() : new Date();

            currentClientHistory.push({
                fecha,
                tipo: "Pago",
                detalle: data.method,
                total: `$${(data.amount || 0).toFixed(2)}`,
            });

            currentPayments.push({
                fecha,
                method: data.method,
                amount: data.amount,
            });
        });
    }

    currentClientHistory.sort((a, b) => b.fecha - a.fecha);
    html += `<button id="exportClientPDF" class="btnExport">Exportar historial PDF</button>`;
    html += `<h4>Historial</h4>`;
    if (currentClientHistory.length === 0) {
        html += `<p>No hay movimientos registrados.</p>`;
    } else {
        currentClientHistory.forEach((entry) => {
            const fecha = entry.fecha.toLocaleString("es-MX", {
                dateStyle: "medium",
                timeStyle: "short",
            });
            html += `<div class="noteBox">
        <p><strong>Fecha:</strong> ${fecha}</p>
        <p><strong>Tipo:</strong> ${entry.tipo}</p>
        <p><strong>Detalle:</strong> ${entry.detalle}</p>
        <p><strong>Total:</strong> ${entry.total}</p>
        </div>`;
        });
    }
    clientReportResult.innerHTML = html;

    document
        .getElementById("exportClientPDF")
        .addEventListener("click", exportClientHistoryToPDF);
}

function exportClientHistoryToPDF() {
    const { jsPDF } = window.jspdf;

    const btn = document.getElementById("exportClientPDF");
    const originalText = btn.textContent;
    btn.disabled = true;
    btn.textContent = "Generando PDF...";

    setTimeout(() => {
        const doc = new jsPDF();
        const clientName =
            document.getElementById("clientNameHeader")?.textContent || "Cliente";
        const clientId =
            document.getElementById("clientIdHeader")?.textContent || "-";
        const clientDebt =
            document.getElementById("clientDebtHeader")?.textContent || "$0.00";

        doc.setFontSize(14);
        doc.text("Historial del Cliente", 14, 20);
        doc.setFontSize(10);
        doc.text(`Nombre: ${clientName}`, 14, 28);
        doc.text(`ID: ${clientId}`, 14, 34);
        doc.text(`Crédito activo: ${clientDebt}`, 14, 40);

        console.log("Productos actuales:", currentProducts);
        console.log("Pagos actuales:", currentPayments);

        if (currentProducts.length > 0) {
            doc.setFontSize(12);
            doc.text("Productos adquiridos:", 14, 50);

            doc.autoTable({
                startY: 55,
                head: [["Fecha", "Producto", "Cantidad", "Precio", "Total"]],
                body: currentProducts.map((p) => [
                    new Date(p.fecha).toLocaleDateString("es-MX"),
                    p.name,
                    p.quantity ?? p.qty ?? 1,
                    `$${(p.price || 0).toFixed(2)}`,
                    `$${((p.price || 0) * (p.quantity ?? p.qty ?? 1)).toFixed(2)}`,
                ]),

                styles: { fontSize: 9, cellPadding: 2 },
                headStyles: { fillColor: [0, 100, 180] },
            });
        } else {
            doc.setFontSize(12);
            doc.text("No hay productos registrados.", 14, 50);
        }

        let y = doc.lastAutoTable ? doc.lastAutoTable.finalY + 10 : 70;

        if (currentPayments.length > 0) {
            doc.setFontSize(12);
            doc.text("Pagos realizados:", 14, y);
            y += 5;

            doc.autoTable({
                startY: y,
                head: [["Fecha", "Método", "Monto"]],
                body: currentPayments.map((p) => [
                    new Date(p.fecha).toLocaleDateString("es-MX"),
                    p.method,
                    `$${p.amount.toFixed(2)}`,
                ]),
                styles: { fontSize: 9, cellPadding: 2 },
                headStyles: { fillColor: [0, 150, 100] },
            });
        } else {
            doc.setFontSize(12);
            doc.text("No hay pagos registrados.", 14, y);
        }

        doc.save(`historial_cliente_${clientId}.pdf`);
        btn.disabled = false;
        btn.textContent = originalText;
    }, 100);
}

async function exportGeneralReportPDF() {
    const { jsPDF } = window.jspdf;
    const btn = document.getElementById("exportGeneralReport");
    const originalText = btn.textContent;
    btn.disabled = true;
    btn.textContent = "Generando PDF...";

    const doc = new jsPDF();

    // Le pedimos a Firestore los clientes, PERO ordenados por su "id".
    const clientsSnap = await getDocs(
        query(collection(db, "clients"), orderBy("id"))
    ); // <-- Aquí aplicamos el mismo cambio

    const rows = [];

    for (const clientDoc of clientsSnap.docs) {
        const data = clientDoc.data();
        const clientId = data.id;
        const name = data.name || "Desconocido";
        const debt = data.currentDebt || 0;

        let lastDate = "Sin registros";
        let lastAction = "-";
        let lastTimestamp = null;

        const [creditsSnap, paymentsSnap] = await Promise.all([
            // NOTA: Aquí la colección es "creditRecords" según tu código anterior.
            // La ajustaré para que coincida con la lógica de la función fetchClientHistory.
            getDocs(
                query(
                    collection(db, "creditRecords"),
                    where("clientId", "==", clientId)
                )
            ),
            getDocs(
                query(collection(db, "payments"), where("clientId", "==", clientId))
            ),
        ]);

        creditsSnap.forEach((doc) => {
            const date = doc.data().date?.toDate?.();
            if (date && (!lastTimestamp || date > lastTimestamp)) {
                lastTimestamp = date;
                lastAction = "Crédito";
            }
        });

        paymentsSnap.forEach((doc) => {
            const date = doc.data().date?.toDate?.();
            if (date && (!lastTimestamp || date > lastTimestamp)) {
                lastTimestamp = date;
                lastAction = `Pago - $${doc.data().amount?.toFixed(2)}`;
            }
        });

        if (lastTimestamp) {
            lastDate = lastTimestamp.toLocaleString("es-MX", {
                dateStyle: "medium",
                timeStyle: "short",
            });
        }

        rows.push([name, clientId, `$${debt.toFixed(2)}`, lastDate, lastAction]);
    }

    doc.setFontSize(14);
    doc.text("Reporte General de Créditos", 14, 20);

    doc.autoTable({
        startY: 30,
        head: [["Nombre", "ID", "Crédito", "Última Fecha", "Último Movimiento"]],
        body: rows,
        styles: { fontSize: 9, cellPadding: 2 },
        headStyles: { fillColor: [34, 122, 158] },
    });

    doc.save("reporte_general_creditos.pdf");
    btn.disabled = false;
    btn.textContent = originalText;
}

exportGeneralBtn.addEventListener("click", exportGeneralReportPDF);

calculateTotalCreditUsed();
populateClientSelect();

const style = document.createElement("style");
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
