import { db } from "./firebaseConfig.js";
import { collection, addDoc, getDocs } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const form = document.getElementById("productForm");
const nameInput = document.getElementById("productName");
const categoryInput = document.getElementById("productCategory");
const addToListBtn = document.getElementById("addToListBtn");
const tableBody = document.getElementById("productTableBody");
const groupedContainer = document.getElementById("groupedProductsContainer");

let tempProducts = [];

// Agregar producto a la lista temporal
addToListBtn.addEventListener("click", () => {
    const name = nameInput.value.trim();
    const category = categoryInput.value.trim();

    if (!name || !category) {
        Swal.fire("Error", "Todos los campos son obligatorios", "error");
        return;
    }

    tempProducts.push({ name, category });

    renderTable();
    form.reset();
});

// Mostrar productos en la tabla
function renderTable() {
    tableBody.innerHTML = "";

    tempProducts.forEach((p, index) => {
        const row = document.createElement("tr");
        row.innerHTML = `
      <td>${p.name}</td>
      <td>${p.category}</td>
      <td><button onclick="removeProduct(${index})">❌</button></td>
    `;
        tableBody.appendChild(row);
    });
}

window.removeProduct = (index) => {
    tempProducts.splice(index, 1);
    renderTable();
};

// Guardar todos en Firestore
document.getElementById("btnSaveAll").addEventListener("click", async () => {
    if (tempProducts.length === 0) {
        Swal.fire("Atención", "Agrega al menos un producto a la lista", "info");
        return;
    }

    try {
        const batch = tempProducts.map(p =>
            addDoc(collection(db, "products"), {
                name: p.name,
                category: p.category,
                createdAt: new Date()
            })
        );

        await Promise.all(batch);
        Swal.fire("Éxito", "Productos guardados correctamente", "success");
        tempProducts = [];
        renderTable();
        loadGroupedProducts();
    } catch (error) {
        console.error(error);
        Swal.fire("Error", "No se pudieron guardar los productos", "error");
    }
});


async function loadGroupedProducts() {
    groupedContainer.innerHTML = "";

    const snapshot = await getDocs(collection(db, "products"));
    const products = snapshot.docs.map(doc => doc.data());

    // Agrupar por categoría
    const grouped = {};
    products.forEach(p => {
        if (!grouped[p.category]) {
            grouped[p.category] = [];
        }
        grouped[p.category].push(p);
    });

    // Renderizar
    Object.keys(grouped).forEach(category => {
        const section = document.createElement("div");
        section.innerHTML = `
      <h4 style="color:#00b894; margin-top:20px;">${category}</h4>
      <table class="groupedTable">
        <thead>
          <tr><th>Nombre</th></tr>
        </thead>
        <tbody>
          ${grouped[category].map(p => `<tr><td>${p.name}</td></tr>`).join("")}
        </tbody>
      </table>
    `;
        groupedContainer.appendChild(section);
    });
}

// Llamar al cargar
loadGroupedProducts();