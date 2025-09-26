import { db } from "./firebaseConfig.js";
import {
    collection, getDocs, query, where, doc, getDoc, addDoc, updateDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const clientSearch = document.getElementById("clientSearch");
const clientInfo = document.getElementById("clientInfo");
const productList = document.getElementById("productList");
const cartTableBody = document.getElementById("cartTableBody");
const cartTotalEl = document.getElementById("cartTotal");
const saveBtn = document.getElementById("saveBtn");

let selectedClient = null;
let cart = [];
let productsByCategory = {};

clientSearch.addEventListener("input", async () => {
    const input = clientSearch.value.trim().toLowerCase();
    const searchResultsEl = document.getElementById("searchResults");

    if (input.length < 2) {
        searchResultsEl.innerHTML = "";
        return;
    }

    const q = query(
        collection(db, "clients"),
        where("nameLower", ">=", input),
        where("nameLower", "<=", input + '\uf8ff')
    );
    
    const snapshot = await getDocs(q);

    searchResultsEl.innerHTML = "";

    if (snapshot.empty) {
        searchResultsEl.innerHTML = "<p>No se encontraron clientes.</p>";
    } else {
        snapshot.forEach(doc => {
            const client = doc.data();
            const resultItem = document.createElement("div");
            resultItem.className = 'search-result-item';
            resultItem.innerHTML = `
                <span>${client.id}. ${client.name}</span>
                <button id="btnSelectClient">Seleccionar</button>
            `;
            
            resultItem.querySelector("button").addEventListener("click", () => {
                selectClient(client);
            });

            searchResultsEl.appendChild(resultItem);
        });
    }
});

function selectClient(client) {
    selectedClient = client;

    clientInfo.innerHTML = `
                            <p><strong>Cliente:</strong> ${selectedClient.name}</p>
                            <p><strong>Crédito usado:</strong> $${selectedClient.currentDebt}</p>
                            `;
    document.getElementById("searchResults").innerHTML = "";
    clientSearch.value = "";
}

// Cargar productos
async function loadProducts() {
    const snapshot = await getDocs(collection(db, "products"));
    const products = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    // Agrupar por categoría
    productsByCategory = {};
    products.forEach(product => {
        if (!productsByCategory[product.category]) {
            productsByCategory[product.category] = [];
        }
        productsByCategory[product.category].push(product);
    });

    renderCategoryButtons();
}

function renderCategoryButtons() {
    const categoryList = document.getElementById("categoryList");
    categoryList.innerHTML = "";

    Object.keys(productsByCategory).forEach(category => {
        const button = document.createElement("button");
        button.id = 'btnCategories';
        button.textContent = category;
        button.style.margin = "6px";
        button.onclick = () => showCategoryProducts(category);
        categoryList.appendChild(button);
    });
}

async function showCategoryProducts(category) {
    const products = productsByCategory[category];

    const html = products.map((p, index) => `
        <div style="display:flex; justify-content:space-between; margin-bottom:8px;">
        <span>${p.name}</span>
        <button id="btnAddOnCategory" onclick="addProductPrompt('${p.id}', '${p.name}')">Agregar</button>
        </div>
    `).join("");

    Swal.fire({
        title: `Productos: ${category}`,
        html,
        showConfirmButton: false,
        width: 400
    });
}



// Agregar producto al carrito
window.addProductPrompt = async (productId, productName) => {
    const { value: formValues } = await Swal.fire({
        title: `Agregar ${productName}`,
        html: `
        <label style="display:block; margin-bottom:6px;">Precio:</label>
        <input type="number" id="swal-price" class="swal2-input" min="0.01" step="0.01" placeholder="Precio unitario" />

        <label style="display:block; margin-top:12px; margin-bottom:6px;">Cantidad:</label>
        <input type="number" id="swal-quantity" class="swal2-input" min="1" step="1" placeholder="Cantidad" value="1" />
        `,
        focusConfirm: false,
        preConfirm: () => {
            const price = parseFloat(document.getElementById("swal-price").value);
            const quantity = parseInt(document.getElementById("swal-quantity").value) || 1;

            if (isNaN(price) || price <= 0) {
                Swal.showValidationMessage("El precio debe ser mayor a cero");
                return false;
            }

            return { price, quantity };
        },
        confirmButtonText: "Agregar al carrito",
        showCancelButton: true,
        scrollbarPadding: false
    });

    if (!formValues) return;

    const { price, quantity } = formValues;
    const index = cart.findIndex(p => p.productId === productId);
    if (index >= 0) {
        cart[index].quantity += quantity;
    } else {
        cart.push({
            productId,
            name: productName,
            price,
            quantity
        });
    }

    renderCart();
};

// Mostrar carrito
function renderCart() {
    cartTableBody.innerHTML = "";
    let total = 0;

    cart.forEach((item, i) => {
        const subtotal = item.quantity * item.price;
        total += subtotal;
        const row = document.createElement("tr");
        row.innerHTML = `
      <td>${item.name}</td>
      <td>${item.quantity}</td>
      <td>$${subtotal}</td>
      <td><button onclick="removeFromCart(${i})">❌</button></td>
    `;
        cartTableBody.appendChild(row);
    });

    cartTotalEl.textContent = `Total: $${total}`;
}

window.removeFromCart = (index) => {
    cart.splice(index, 1);
    renderCart();
};

// Guardar nota
saveBtn.addEventListener("click", async () => {
    if (!selectedClient) {
        Swal.fire("Error", "Selecciona un cliente válido", "error");
        return;
    }

    if (cart.length === 0) {
        Swal.fire("Error", "No hay productos en el carrito", "error");
        return;
    }

    const total = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const nuevoTotal = selectedClient.currentDebt + total;

    if (nuevoTotal > selectedClient.creditLimit) {
        Swal.fire("Crédito excedido", `El total de esta nota sobrepasa el límite de crédito ($${selectedClient.creditLimit})`, "warning");
        return;
    }

    try {
        // 1. Registrar nota
        await addDoc(collection(db, "creditRecords"), {
            clientId: selectedClient.id,
            clientName: selectedClient.name,
            items: cart,
            total,
            date: new Date()
        });

        // 2. Actualizar deuda del cliente
        const clientRef = doc(db, "clients", String(selectedClient.id));
        await updateDoc(clientRef, {
            currentDebt: nuevoTotal
        });

        Swal.fire("Éxito", "Crédito registrado correctamente", "success").then(() => {
            location.reload();
        });

    } catch (error) {
        console.error(error);
        Swal.fire("Error", "No se pudo registrar el crédito", "error");
    }
});

loadProducts();
