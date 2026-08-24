import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  Plus, Minus, Trash2, X, Check, Clock, Search, Users, ClipboardList,
  Settings, LogOut, Copy, Pencil, ShieldCheck, ArrowLeft, FileText,
  Printer, Truck, Receipt, User, Boxes, PackagePlus, AlertTriangle, UserCog, KeyRound
} from "lucide-react";

// ==================== SUPABASE ====================
const SUPABASE_URL = "https://bfunjsvmimxxzysxjguo.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJmdW5qc3ZtaW14eHp5c3hqZ3VvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODczNTczNDEsImV4cCI6MjEwMjkzMzM0MX0.kvKEm580QMdIPp9qoRSehFw4fvPuLeqJ7G1_P16bGmc";

async function sb(path, options = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...options,
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      "Content-Type": "application/json",
      Prefer: options.prefer || "return=representation",
      ...(options.headers || {}),
    },
  });
  if (!res.ok) throw new Error(await res.text());
  if (res.status === 204) return null;
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}
const sbSelect = (table, query = "select=*&order=created_at.asc") => sb(`${table}?${query}`);
const sbInsert = async (table, row) => (await sb(table, { method: "POST", body: JSON.stringify(row) }))[0];
const sbUpdate = async (table, id, patch) => (await sb(`${table}?id=eq.${id}`, { method: "PATCH", body: JSON.stringify(patch) }))[0];
const sbDelete = (table, id) => sb(`${table}?id=eq.${id}`, { method: "DELETE", prefer: "return=minimal" });
const sbSingleton = async (table) => (await sb(`${table}?id=eq.1&select=*`))[0];
const sbUpdateSingleton = async (table, patch) => (await sb(`${table}?id=eq.1`, { method: "PATCH", body: JSON.stringify(patch) }))[0];

// Envoi d'une alerte Telegram (appel direct à l'API Telegram, gratuite et sans limite)
function sendWhatsAppAlert(settings, text) {
  if (!settings?.telegram_bot_token || !settings?.telegram_chat_id) return;
  const url = `https://api.telegram.org/bot${settings.telegram_bot_token}/sendMessage?chat_id=${encodeURIComponent(settings.telegram_chat_id)}&text=${encodeURIComponent(text)}`;
  fetch(url).catch(() => {});
}

const mapOrder = (r) => ({
  ...r,
  clientId: r.client_id,
  seenByAdmin: r.seen_by_admin,
  blNumber: r.bl_number,
  factureNumber: r.facture_number,
  factureDate: r.facture_date,
  vatIncluded: r.vat_included,
  total: Number(r.total),
  items: (r.items || []).map((it) => ({ ...it, price: Number(it.price) })),
});

const STATUS = {
  attente: { label: "En attente", color: "#C9A15A", bg: "rgba(201,161,90,0.12)" },
  confirmee: { label: "Confirmée", color: "#6FA383", bg: "rgba(111,163,131,0.12)" },
  livree: { label: "Livrée", color: "#8B93A0", bg: "rgba(139,147,160,0.12)" },
};

// Compresse et redimensionne une image avant sauvegarde (reste léger en base de données)
function fileToCompressedImage(file, maxDim = 400, quality = 0.72) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = () => {
      const img = new Image();
      img.onerror = reject;
      img.onload = () => {
        let { width, height } = img;
        if (width > height && width > maxDim) { height = Math.round((height * maxDim) / width); width = maxDim; }
        else if (height > maxDim) { width = Math.round((width * maxDim) / height); height = maxDim; }
        const canvas = document.createElement("canvas");
        canvas.width = width; canvas.height = height;
        canvas.getContext("2d").drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

const genCode = () => {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let c = "";
  for (let i = 0; i < 6; i++) c += chars[Math.floor(Math.random() * chars.length)];
  return c;
};
const pad = (n) => String(n).padStart(4, "0");

const FALLBACK_LOGO = "data:image/png;base64,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";

const fontImport = `
  @import url('https://fonts.googleapis.com/css2?family=Fraunces:wght@500;600;700&family=Inter:wght@400;500;600;700&family=Space+Mono:wght@400;700&display=swap');
  @keyframes spin { to { transform: rotate(360deg); } }
  @media print {
    body * { visibility: hidden; }
    #print-area, #print-area * { visibility: visible; }
    #print-area { position: fixed; inset: 0; padding: 24px; background: #fff !important; }
  }
`;

export default function App() {
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [catalog, setCatalog] = useState([]);
  const [orders, setOrders] = useState([]);
  const [clients, setClients] = useState([]);
  const [rawMaterials, setRawMaterials] = useState([]);
  const [recipeItems, setRecipeItems] = useState([]);
  const [adminUsers, setAdminUsers] = useState([]);
  const [activityLog, setActivityLog] = useState([]);
  const [settings, setSettingsState] = useState({ id: 1, admin_code: null, next_bl: 1, next_facture: 1 });
  const [company, setCompany] = useState({ name: "", ice: "", rc: "", address: "", phone: "", email: "" });
  const [toast, setToast] = useState("");

  const [mode, setMode] = useState("client-login");
  const [adminUnlocked, setAdminUnlocked] = useState(false);
  const [currentAdmin, setCurrentAdmin] = useState(null); // { name, role: 'principal' | 'membre' }
  const [pinInput, setPinInput] = useState("");
  const [pinSetup, setPinSetup] = useState("");
  const [activeClient, setActiveClient] = useState(null);
  const [clientCodeInput, setClientCodeInput] = useState("");
  const [clientLoginError, setClientLoginError] = useState("");

  const flash = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(""), 2400);
  };

  const loadAll = useCallback(async () => {
    try {
      const [cat, cl, ord, set, comp, rm, ri, au, al] = await Promise.all([
        sbSelect("catalog"),
        sbSelect("clients"),
        sbSelect("orders", "select=*&order=date.desc"),
        sbSingleton("settings"),
        sbSingleton("company"),
        sbSelect("raw_materials"),
        sbSelect("recipe_items"),
        sbSelect("admin_users"),
        sbSelect("activity_log", "select=*&order=created_at.desc&limit=200"),
      ]);
      setCatalog(cat || []);
      setClients(cl || []);
      setOrders((ord || []).map(mapOrder));
      setSettingsState(set || { id: 1, admin_code: null, next_bl: 1, next_facture: 1 });
      setCompany(comp || {});
      setRawMaterials(rm || []);
      setRecipeItems(ri || []);
      setAdminUsers(au || []);
      setActivityLog(al || []);
      setLoadError(false);
    } catch (e) {
      setLoadError(true);
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  useEffect(() => {
    if (mode !== "admin") return;
    const interval = setInterval(async () => {
      try {
        const ord = await sbSelect("orders", "select=*&order=date.desc");
        setOrders((ord || []).map(mapOrder));
      } catch {}
    }, 15000);
    return () => clearInterval(interval);
  }, [mode]);

  // ---- catalogue CRUD ----
  const addCatalogItem = async (item) => {
    try {
      const row = await sbInsert("catalog", item);
      setCatalog((c) => [...c, row]);
    } catch { flash("Échec de l'enregistrement"); }
  };
  const updateCatalogItem = async (id, patch) => {
    try {
      const row = await sbUpdate("catalog", id, patch);
      setCatalog((c) => c.map((i) => (i.id === id ? row : i)));
    } catch { flash("Échec de la mise à jour"); }
  };
  const deleteCatalogItem = async (id) => {
    try {
      await sbDelete("catalog", id);
      setCatalog((c) => c.filter((i) => i.id !== id));
    } catch { flash("Échec de la suppression"); }
  };

  // ---- clients CRUD ----
  const addClient = async (client) => {
    try {
      const row = await sbInsert("clients", client);
      setClients((c) => [row, ...c]);
      return row;
    } catch { flash("Échec de l'enregistrement"); return null; }
  };
  const updateClient = async (id, patch) => {
    try {
      const row = await sbUpdate("clients", id, patch);
      setClients((c) => c.map((cl) => (cl.id === id ? row : cl)));
      if (activeClient?.id === id) setActiveClient(row);
      return row;
    } catch { flash("Échec de la mise à jour"); return null; }
  };
  const deleteClient = async (id) => {
    try {
      const c = clients.find((x) => x.id === id);
      await sbDelete("clients", id);
      setClients((cs) => cs.filter((cl) => cl.id !== id));
      logActivity(`A supprimé le client "${c?.denomination || id}"`);
    } catch { flash("Échec de la suppression"); }
  };

  // ---- document numbering ----
  const nextDocNumber = async (kind) => {
    const col = kind === "bl" ? "next_bl" : "next_facture";
    try {
      const fresh = await sbSingleton("settings");
      const n = fresh[col] || 1;
      const updated = await sbUpdateSingleton("settings", { [col]: n + 1 });
      setSettingsState(updated);
      return kind === "bl" ? `BL-${pad(n)}` : `FACT-${pad(n)}`;
    } catch {
      flash("Échec de génération du numéro");
      return kind === "bl" ? `BL-${pad(Date.now() % 9999)}` : `FACT-${pad(Date.now() % 9999)}`;
    }
  };

  // ---- journal d'activité ----
  const logActivity = async (action) => {
    if (!currentAdmin) return;
    try {
      const row = await sbInsert("activity_log", { admin_name: currentAdmin.name, role: currentAdmin.role, action });
      setActivityLog((a) => [row, ...a]);
    } catch {}
  };
  const unseenLogins = activityLog.filter((a) => a.action === "Connexion" && !a.seen_by_principal).length;
  const markActivitySeen = async () => {
    const unseen = activityLog.filter((a) => !a.seen_by_principal);
    setActivityLog((a) => a.map((x) => ({ ...x, seen_by_principal: true })));
    for (const a of unseen) { try { await sbUpdate("activity_log", a.id, { seen_by_principal: true }); } catch {} }
  };

  // ---- membres admin (accès restreint) ----
  const addAdminMember = async (member) => {
    try {
      const row = await sbInsert("admin_users", member);
      setAdminUsers((m) => [...m, row]);
      logActivity(`A créé le membre "${member.name}"`);
      return row;
    } catch { flash("Échec de l'enregistrement"); return null; }
  };
  const deleteAdminMember = async (id, name) => {
    try {
      await sbDelete("admin_users", id);
      setAdminUsers((m) => m.filter((x) => x.id !== id));
      logActivity(`A supprimé le membre "${name}"`);
    } catch { flash("Échec de la suppression"); }
  };
  const changeAdminPin = async (newPin) => {
    try {
      const updated = await sbUpdateSingleton("settings", { admin_code: newPin });
      setSettingsState(updated);
      logActivity("A changé le code d'accès principal");
      return true;
    } catch { flash("Échec de la mise à jour"); return false; }
  };
  const updateNotificationSettings = async (patch) => {
    try {
      const updated = await sbUpdateSingleton("settings", patch);
      setSettingsState(updated);
      flash("Réglages de notification enregistrés");
      return true;
    } catch { flash("Échec de la mise à jour"); return false; }
  };

  // ---- matières premières CRUD ----
  const addRawMaterial = async (item) => {
    try {
      const row = await sbInsert("raw_materials", item);
      setRawMaterials((r) => [...r, row]);
    } catch { flash("Échec de l'enregistrement"); }
  };
  const updateRawMaterial = async (id, patch) => {
    try {
      const row = await sbUpdate("raw_materials", id, patch);
      setRawMaterials((r) => r.map((i) => (i.id === id ? row : i)));
    } catch { flash("Échec de la mise à jour"); }
  };
  const deleteRawMaterial = async (id) => {
    try {
      await sbDelete("raw_materials", id);
      setRawMaterials((r) => r.filter((i) => i.id !== id));
    } catch { flash("Échec de la suppression (vérifie qu'elle n'est pas utilisée dans une recette)"); }
  };
  const restockRawMaterial = async (item, addQty) => {
    const newQty = Number(item.stock_quantity) + Number(addQty);
    await updateRawMaterial(item.id, { stock_quantity: newQty });
  };

  // ---- recettes CRUD ----
  const setRecipeForCatalogItem = async (catalogId, items) => {
    // items: [{raw_material_id, quantity}]
    try {
      const existing = recipeItems.filter((r) => r.catalog_id === catalogId);
      for (const ex of existing) await sbDelete("recipe_items", ex.id);
      const inserted = [];
      for (const it of items) {
        if (!it.raw_material_id || !it.quantity) continue;
        const row = await sbInsert("recipe_items", { catalog_id: catalogId, raw_material_id: it.raw_material_id, quantity: parseFloat(it.quantity) });
        inserted.push(row);
      }
      setRecipeItems((r) => [...r.filter((x) => x.catalog_id !== catalogId), ...inserted]);
      flash("Recette enregistrée");
    } catch { flash("Échec de l'enregistrement de la recette"); }
  };

  // ---- production (ajout de stock produit fini + consommation des matières) ----
  const produceStock = async (catalogItem, qty) => {
    try {
      const items = recipeItems.filter((r) => r.catalog_id === catalogItem.id);
      for (const ri of items) {
        const rm = rawMaterials.find((m) => m.id === ri.raw_material_id);
        if (!rm) continue;
        const newQty = Number(rm.stock_quantity) - Number(ri.quantity) * qty;
        await updateRawMaterial(rm.id, { stock_quantity: newQty });
        const threshold = Number(rm.alert_threshold || 0);
        if (settings.whatsapp_notify_stock && newQty <= threshold && Number(rm.stock_quantity) > threshold) {
          sendWhatsAppAlert(settings, `⚠️ Stock bas — "${rm.name}" : ${newQty} ${rm.unit} restant(s) (seuil: ${threshold}).`);
        }
      }
      const newStock = Number(catalogItem.stock_quantity || 0) + Number(qty);
      await updateCatalogItem(catalogItem.id, { stock_quantity: newStock });
      flash(`${qty} unité(s) de ${catalogItem.name} ajoutée(s) au stock`);
    } catch { flash("Échec de la production"); }
  };


  const addOrder = async (order) => {
    try {
      const blNumber = await nextDocNumber("bl");
      const row = {
        client_id: order.clientId,
        denomination: order.denomination,
        ice: order.ice,
        address: order.address,
        phone: order.phone,
        notes: order.notes,
        items: order.items,
        total: order.total,
        status: "attente",
        seen_by_admin: false,
        bl_number: blNumber,
        date: new Date().toISOString(),
      };
      const inserted = await sbInsert("orders", row);
      setOrders((o) => [mapOrder(inserted), ...o]);

      if (settings.whatsapp_notify_orders) {
        sendWhatsAppAlert(
          settings,
          `🛎️ Nouvelle commande ${blNumber}\nClient: ${order.denomination || "—"}\nTotal: ${Number(order.total).toFixed(2)} DH`
        );
      }

      // Déduction automatique du stock (matières premières + produits finis)
      for (const line of order.items) {
        const catItem = catalog.find((c) => c.id === line.id);
        if (catItem) {
          const newFinished = Number(catItem.stock_quantity || 0) - Number(line.qty);
          try {
            const patched = await sbUpdate("catalog", catItem.id, { stock_quantity: newFinished });
            setCatalog((c) => c.map((i) => (i.id === catItem.id ? patched : i)));
            if (settings.whatsapp_notify_stock && newFinished <= 0 && Number(catItem.stock_quantity || 0) > 0) {
              sendWhatsAppAlert(settings, `⚠️ Stock critique — "${catItem.name}" : ${newFinished} en stock.`);
            }
          } catch {}
        }
        const linkedRecipe = recipeItems.filter((r) => r.catalog_id === line.id);
        for (const ri of linkedRecipe) {
          const rm = rawMaterials.find((m) => m.id === ri.raw_material_id);
          if (!rm) continue;
          const newQty = Number(rm.stock_quantity) - Number(ri.quantity) * Number(line.qty);
          try {
            const patched = await sbUpdate("raw_materials", rm.id, { stock_quantity: newQty });
            setRawMaterials((rows) => rows.map((x) => (x.id === rm.id ? patched : x)));
            const threshold = Number(rm.alert_threshold || 0);
            if (settings.whatsapp_notify_stock && newQty <= threshold && Number(rm.stock_quantity) > threshold) {
              sendWhatsAppAlert(settings, `⚠️ Stock bas — "${rm.name}" : ${newQty} ${rm.unit} restant(s) (seuil: ${threshold}).`);
            }
          } catch {}
        }
      }

      return true;
    } catch { flash("Échec de l'envoi de la commande"); return false; }
  };
  const updateOrder = async (id, patch) => {
    try {
      const row = await sbUpdate("orders", id, patch);
      setOrders((o) => o.map((ord) => (ord.id === id ? mapOrder(row) : ord)));
    } catch { flash("Échec de la mise à jour"); }
  };
  const deleteOrder = async (id) => {
    try {
      await sbDelete("orders", id);
      setOrders((o) => o.filter((ord) => ord.id !== id));
      logActivity("A supprimé une commande");
    } catch { flash("Échec de la suppression"); }
  };
  const generateFacture = async (order) => {
    const factureNumber = await nextDocNumber("facture");
    await updateOrder(order.id, { facture_number: factureNumber, facture_date: new Date().toISOString() });
    logActivity(`A généré la facture ${factureNumber}`);
    flash(`Facture ${factureNumber} générée`);
  };
  const markAllSeen = async () => {
    const unseen = orders.filter((o) => !o.seenByAdmin);
    setOrders((o) => o.map((ord) => ({ ...ord, seenByAdmin: true })));
    for (const o of unseen) {
      try { await sbUpdate("orders", o.id, { seen_by_admin: true }); } catch {}
    }
  };
  const unseenCount = orders.filter((o) => !o.seenByAdmin).length;

  // ---- auth ----
  const setupAdminPin = async () => {
    if (pinSetup.trim().length < 4) return flash("4 caractères minimum");
    const updated = await sbUpdateSingleton("settings", { admin_code: pinSetup.trim() });
    setSettingsState(updated);
    setAdminUnlocked(true);
    setCurrentAdmin({ name: "Admin principal", role: "principal" });
    setMode("admin");
    flash("Code pro créé");
  };
  const tryAdminLogin = async () => {
    const code = pinInput.trim();
    if (code === settings.admin_code) {
      setAdminUnlocked(true);
      setCurrentAdmin({ name: "Admin principal", role: "principal" });
      setMode("admin");
      setPinInput("");
      try {
        const row = await sbInsert("activity_log", { admin_name: "Admin principal", role: "principal", action: "Connexion" });
        setActivityLog((a) => [row, ...a]);
      } catch {}
      return;
    }
    const member = adminUsers.find((m) => m.code === code);
    if (member) {
      setAdminUnlocked(true);
      setCurrentAdmin({ name: member.name, role: "membre" });
      setMode("admin");
      setPinInput("");
      try {
        const row = await sbInsert("activity_log", { admin_name: member.name, role: "membre", action: "Connexion" });
        setActivityLog((a) => [row, ...a]);
      } catch {}
      return;
    }
    flash("Code incorrect");
  };
  const tryClientLogin = () => {
    const code = clientCodeInput.trim().toUpperCase();
    const found = clients.find((c) => c.code === code);
    if (found) {
      setActiveClient(found);
      setMode("client");
      setClientCodeInput("");
      setClientLoginError("");
    } else setClientLoginError("Code invalide. Vérifie auprès de ton traiteur.");
  };
  const logout = () => {
    setMode("client-login");
    setAdminUnlocked(false);
    setCurrentAdmin(null);
    setActiveClient(null);
  };

  const COMPANY = {
    name: company.name || "Amimouss Food",
    ice: company.ice || "",
    rc: company.rc || "",
    address: company.address || "",
    phone: company.phone || "",
    email: company.email || "",
    logo: FALLBACK_LOGO,
  };

  if (!loaded) {
    return (
      <div style={styles.loadingScreen}>
        <style>{fontImport}</style>
        <div style={styles.loadingTicket} />
      </div>
    );
  }

  if (loadError) {
    return (
      <div style={styles.loadingScreen}>
        <style>{fontImport}</style>
        <div style={{ color: "#EDEFF2", textAlign: "center", padding: 24 }}>
          <div style={{ marginBottom: 12 }}>Connexion à la base de données impossible.</div>
          <button onClick={loadAll} style={styles.primaryBtnSmall}>Réessayer</button>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.app}>
      <style>{fontImport}</style>

      {mode === "admin-setup" && (
        <PinScreen title="Crée ton code d'accès pro" subtitle="Ce code te servira à revenir dans ton espace admin. Garde-le pour toi."
          value={pinSetup} onChange={setPinSetup} onSubmit={setupAdminPin} onBack={() => setMode("client-login")} buttonLabel="Créer et entrer" logo={COMPANY.logo} />
      )}
      {mode === "admin-login" && (
        <PinScreen title="Espace professionnel" subtitle="Entre ton code d'accès."
          value={pinInput} onChange={setPinInput} onSubmit={tryAdminLogin} onBack={() => setMode("client-login")} buttonLabel="Entrer" logo={COMPANY.logo} />
      )}
      {mode === "client-login" && (
        <ClientLoginScreen value={clientCodeInput} onChange={setClientCodeInput} onSubmit={tryClientLogin}
          onAdminAccess={() => setMode(settings.admin_code ? "admin-login" : "admin-setup")} error={clientLoginError} company={COMPANY} />
      )}
      {mode === "admin" && adminUnlocked && (
        <AdminApp
          company={COMPANY}
          currentAdmin={currentAdmin}
          catalog={catalog} addCatalogItem={addCatalogItem} updateCatalogItem={updateCatalogItem} deleteCatalogItem={deleteCatalogItem}
          orders={orders} updateOrder={updateOrder} deleteOrder={deleteOrder} generateFacture={generateFacture}
          clients={clients} addClient={addClient} updateClient={updateClient} deleteClient={deleteClient}
          rawMaterials={rawMaterials} addRawMaterial={addRawMaterial} updateRawMaterial={updateRawMaterial}
          deleteRawMaterial={deleteRawMaterial} restockRawMaterial={restockRawMaterial}
          recipeItems={recipeItems} setRecipeForCatalogItem={setRecipeForCatalogItem} produceStock={produceStock}
          adminUsers={adminUsers} addAdminMember={addAdminMember} deleteAdminMember={deleteAdminMember}
          changeAdminPin={changeAdminPin} activityLog={activityLog} unseenLogins={unseenLogins} markActivitySeen={markActivitySeen}
          settings={settings} updateNotificationSettings={updateNotificationSettings}
          unseenCount={unseenCount} markAllSeen={markAllSeen}
          onLogout={logout} flash={flash}
        />
      )}
      {mode === "client" && activeClient && (
        <ClientApp
          company={COMPANY}
          client={activeClient}
          onUpdateClient={(patch) => updateClient(activeClient.id, patch)}
          catalog={catalog}
          orders={orders.filter((o) => o.clientId === activeClient.id)}
          onSubmitOrder={addOrder}
          onLogout={logout}
          flash={flash}
        />
      )}
      {toast && <div style={styles.toast}>{toast}</div>}
    </div>
  );
}

// ==================== ACCUEIL / AUTH ====================
function PinScreen({ title, subtitle, value, onChange, onSubmit, onBack, buttonLabel }) {
  return (
    <div style={styles.landingWrap}>
      <button onClick={onBack} style={styles.backBtn}><ArrowLeft size={15} /> Retour</button>
      <div style={styles.pinBox}>
        <div style={styles.pinTitle}>{title}</div>
        <div style={styles.pinSub}>{subtitle}</div>
        <input type="password" value={value} onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && onSubmit()} style={styles.pinInput} placeholder="••••" autoFocus />
        <button onClick={onSubmit} style={styles.primaryBtn}>{buttonLabel}</button>
      </div>
    </div>
  );
}

function ClientLoginScreen({ value, onChange, onSubmit, onAdminAccess, error, company }) {
  return (
    <div style={styles.landingWrap}>
      <div style={styles.landingBrand}>
        <img src={company.logo} alt={company.name} style={styles.logoImg} />
        <div style={styles.landingTitle}>{company.name || "Amimouss Food"}</div>
        <div style={styles.landingSub}>Espace client</div>
      </div>
      <div style={styles.pinBox}>
        <div style={styles.pinTitle}>Ton code client</div>
        <div style={styles.pinSub}>Ton traiteur t'a remis un code à 6 caractères.</div>
        <input value={value} onChange={(e) => onChange(e.target.value.toUpperCase())}
          onKeyDown={(e) => e.key === "Enter" && onSubmit()}
          style={{ ...styles.pinInput, letterSpacing: 5, fontFamily: "'Space Mono', monospace" }}
          placeholder="XXXXXX" maxLength={6} autoFocus />
        {error && <div style={styles.errorText}>{error}</div>}
        <button onClick={onSubmit} style={styles.primaryBtn}>Entrer</button>
      </div>
      <div style={styles.landingFooter}>
        <div>{company.name} {company.ice && `· ICE ${company.ice}`}</div>
        <div>{company.phone} {company.email && `· ${company.email}`}</div>
        <button onClick={onAdminAccess} style={styles.adminLink}>Accès professionnel</button>
      </div>
    </div>
  );
}

// ==================== ADMIN APP ====================
function AdminApp({ company, currentAdmin, catalog, addCatalogItem, updateCatalogItem, deleteCatalogItem, orders, updateOrder, deleteOrder, generateFacture, clients, addClient, updateClient, deleteClient, unseenCount, markAllSeen, rawMaterials, addRawMaterial, updateRawMaterial, deleteRawMaterial, restockRawMaterial, recipeItems, setRecipeForCatalogItem, produceStock, adminUsers, addAdminMember, deleteAdminMember, changeAdminPin, activityLog, unseenLogins, markActivitySeen, settings, updateNotificationSettings, onLogout, flash }) {
  const [tab, setTab] = useState("home");
  const isPrincipal = currentAdmin?.role === "principal";

  const modules = [
    { k: "commandes", label: "Commandes", desc: "Suivi et facturation", icon: ClipboardList, badge: unseenCount },
    { k: "catalogue", label: "Catalogue", desc: "Tes plats et prix", icon: Settings },
    { k: "stock", label: "Stock", desc: "Matières & production", icon: Boxes },
    { k: "clients", label: "Clients", desc: "Accès et tarifs", icon: Users },
    { k: "societe", label: "Société", desc: "Infos & sécurité", icon: ShieldCheck },
    ...(isPrincipal ? [{ k: "membres", label: "Membres", desc: "Accès & historique", icon: UserCog, badge: unseenLogins }] : []),
  ];
  const currentModule = modules.find((m) => m.k === tab);

  const openTab = (k) => {
    setTab(k);
    if (k === "commandes") markAllSeen();
    if (k === "membres") markActivitySeen();
  };

  return (
    <div style={styles.shell}>
      <header style={styles.header}>
        <div style={styles.headerLeft}>
          {tab !== "home" ? (
            <button onClick={() => setTab("home")} style={styles.backIconBtn}><ArrowLeft size={18} /></button>
          ) : (
            <img src={company.logo} alt="" style={styles.logoImgSmall} />
          )}
          <div>
            <div style={styles.brand}>{tab === "home" ? "Espace pro" : currentModule?.label}</div>
            <div style={styles.brandSub}>{tab === "home" ? `${currentAdmin?.name}${!isPrincipal ? " · accès restreint" : ""}` : currentModule?.desc}</div>
          </div>
        </div>
        <button onClick={onLogout} style={styles.logoutBtn}><LogOut size={15} /></button>
      </header>

      {tab === "home" ? (
        <main style={styles.main}>
          <div style={styles.moduleGrid}>
            {modules.map((m) => (
              <button key={m.k} onClick={() => openTab(m.k)} style={styles.moduleCard}>
                {!!m.badge && <span style={styles.moduleBadge}>{m.badge}</span>}
                <m.icon size={26} color={C.gold} strokeWidth={1.7} />
                <div style={styles.moduleCardLabel}>{m.label}</div>
                <div style={styles.moduleCardDesc}>{m.desc}</div>
              </button>
            ))}
          </div>
        </main>
      ) : (
        <main style={styles.main}>
          {tab === "commandes" && <OrdersAdmin company={company} orders={orders} updateOrder={updateOrder} deleteOrder={deleteOrder} generateFacture={generateFacture} clients={clients} flash={flash} />}
          {tab === "catalogue" && <CatalogueAdmin catalog={catalog} addCatalogItem={addCatalogItem} updateCatalogItem={updateCatalogItem} deleteCatalogItem={deleteCatalogItem} flash={flash} />}
          {tab === "stock" && (
            <StockAdmin
              catalog={catalog} rawMaterials={rawMaterials} addRawMaterial={addRawMaterial}
              updateRawMaterial={updateRawMaterial} deleteRawMaterial={deleteRawMaterial} restockRawMaterial={restockRawMaterial}
              recipeItems={recipeItems} setRecipeForCatalogItem={setRecipeForCatalogItem} produceStock={produceStock} flash={flash}
            />
          )}
          {tab === "clients" && <ClientsAdmin clients={clients} addClient={addClient} updateClient={updateClient} deleteClient={deleteClient} orders={orders} catalog={catalog} flash={flash} canDelete={isPrincipal} />}
          {tab === "societe" && <SocieteAdmin company={company} isPrincipal={isPrincipal} changeAdminPin={changeAdminPin} settings={settings} updateNotificationSettings={updateNotificationSettings} flash={flash} />}
          {tab === "membres" && isPrincipal && (
            <MembresAdmin adminUsers={adminUsers} addAdminMember={addAdminMember} deleteAdminMember={deleteAdminMember} activityLog={activityLog} flash={flash} />
          )}
        </main>
      )}
    </div>
  );
}

function OrdersAdmin({ company, orders, updateOrder, deleteOrder, generateFacture, clients, flash }) {
  const [docView, setDocView] = useState(null);

  const cycleStatus = (o) => {
    const keys = Object.keys(STATUS);
    const i = keys.indexOf(o.status);
    updateOrder(o.id, { status: keys[(i + 1) % keys.length] });
  };
  const clientOf = (o) => clients.find((c) => c.id === o.clientId);

  return (
    <div style={styles.historyList}>
      {orders.length === 0 && <div style={styles.emptyState}>Aucune commande pour le moment.</div>}
      {orders.map((o) => {
        const st = STATUS[o.status];
        const client = clientOf(o);
        return (
          <div key={o.id} style={styles.orderCard}>
            <div style={styles.orderCardHead}>
              <div>
                <div style={styles.orderClient}>
                  {o.denomination || client?.denomination || "Client"} {!o.seenByAdmin && <span style={styles.newDot} />}
                </div>
                <div style={styles.orderMeta}>
                  {o.blNumber} · {new Date(o.date).toLocaleString("fr-FR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                </div>
              </div>
              <button onClick={() => cycleStatus(o)} style={{ ...styles.statusPill, color: st.color, background: st.bg }}>
                {o.status === "livree" ? <Check size={12} /> : <Clock size={12} />} {st.label}
              </button>
            </div>
            <div style={styles.orderItems}>
              {o.items.map((it, idx) => (
                <div key={idx} style={styles.orderItemRow}><span>{it.qty}× {it.name}</span><span>{(it.price * it.qty).toFixed(2)} DH</span></div>
              ))}
            </div>
            {o.notes && <div style={styles.orderNotes}>Note : {o.notes}</div>}
            <div style={styles.orderCardFoot}>
              <span style={styles.orderTotal}>{o.total.toFixed(2)} DH</span>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button onClick={() => setDocView({ order: o, type: "bl" })} style={styles.docBtn}><Truck size={12} /> Bon de livraison</button>
                {o.status === "livree" && !o.factureNumber && (
                  <button onClick={() => generateFacture(o)} style={styles.docBtnAccent}><Receipt size={12} /> Générer la facture</button>
                )}
                {o.factureNumber && (
                  <button onClick={() => setDocView({ order: o, type: "facture" })} style={styles.docBtnAccent}><Receipt size={12} /> Facture</button>
                )}
                <button onClick={() => deleteOrder(o.id)} style={styles.deleteBtn}><Trash2 size={13} /></button>
              </div>
            </div>
          </div>
        );
      })}
      {docView && <DocumentModal company={company} order={docView.order} type={docView.type} client={clientOf(docView.order)} onClose={() => setDocView(null)} onToggleVat={(val) => updateOrder(docView.order.id, { vat_included: val })} />}
    </div>
  );
}

function CatalogueAdmin({ catalog, addCatalogItem, updateCatalogItem, deleteCatalogItem, flash }) {
  const [newItem, setNewItem] = useState({ name: "", price: "", category: "", image_url: "" });
  const [editingId, setEditingId] = useState(null);
  const [editDraft, setEditDraft] = useState({});
  const [uploading, setUploading] = useState(false);

  const handleImageChange = async (e, target) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const dataUrl = await fileToCompressedImage(file);
      if (target === "new") setNewItem((n) => ({ ...n, image_url: dataUrl }));
      else setEditDraft((d) => ({ ...d, image_url: dataUrl }));
    } catch { flash("Échec du traitement de l'image"); }
    setUploading(false);
  };

  const addItem = () => {
    if (!newItem.name.trim() || !newItem.price) return flash("Nom et prix requis");
    addCatalogItem({ name: newItem.name.trim(), price: parseFloat(newItem.price), category: newItem.category.trim() || "Autre", image_url: newItem.image_url || null });
    setNewItem({ name: "", price: "", category: "", image_url: "" });
  };
  const startEdit = (item) => { setEditingId(item.id); setEditDraft(item); };
  const saveEdit = () => {
    updateCatalogItem(editingId, { name: editDraft.name, category: editDraft.category, price: parseFloat(editDraft.price), image_url: editDraft.image_url || null });
    setEditingId(null);
  };

  return (
    <div>
      <div style={styles.addItemRow}>
        <label style={styles.imageUploadBtn}>
          {newItem.image_url ? <img src={newItem.image_url} alt="" style={styles.imageThumb} /> : <span style={{ fontSize: 11 }}>Photo</span>}
          <input type="file" accept="image/*" onChange={(e) => handleImageChange(e, "new")} style={{ display: "none" }} />
        </label>
        <input placeholder="Nom du plat" value={newItem.name} onChange={(e) => setNewItem({ ...newItem, name: e.target.value })} style={styles.addInput} />
        <input placeholder="Catégorie" value={newItem.category} onChange={(e) => setNewItem({ ...newItem, category: e.target.value })} style={{ ...styles.addInput, maxWidth: 130 }} />
        <input placeholder="Prix DH" type="number" step="0.01" value={newItem.price} onChange={(e) => setNewItem({ ...newItem, price: e.target.value })} style={{ ...styles.addInput, maxWidth: 90 }} />
        <button onClick={addItem} style={styles.addBtn} disabled={uploading}><Plus size={16} /> Ajouter</button>
      </div>
      <div style={styles.catalogueTable}>
        {catalog.length === 0 && <div style={styles.emptyState}>Ton menu est vide.</div>}
        {catalog.map((item) =>
          editingId === item.id ? (
            <div key={item.id} style={styles.catalogueRow}>
              <label style={styles.imageUploadBtn}>
                {editDraft.image_url ? <img src={editDraft.image_url} alt="" style={styles.imageThumb} /> : <span style={{ fontSize: 10 }}>Photo</span>}
                <input type="file" accept="image/*" onChange={(e) => handleImageChange(e, "edit")} style={{ display: "none" }} />
              </label>
              <input value={editDraft.name} onChange={(e) => setEditDraft({ ...editDraft, name: e.target.value })} style={{ ...styles.addInput, flex: 2 }} />
              <input value={editDraft.category} onChange={(e) => setEditDraft({ ...editDraft, category: e.target.value })} style={{ ...styles.addInput, flex: 1 }} />
              <input type="number" step="0.01" value={editDraft.price} onChange={(e) => setEditDraft({ ...editDraft, price: e.target.value })} style={{ ...styles.addInput, width: 70 }} />
              <button onClick={saveEdit} style={styles.iconBtnGhost}><Check size={15} /></button>
            </div>
          ) : (
            <div key={item.id} style={styles.catalogueRow}>
              {item.image_url ? <img src={item.image_url} alt="" style={styles.imageThumb} /> : <div style={styles.imageThumbEmpty} />}
              <span style={styles.catalogueRowName}>{item.name}</span>
              <span style={styles.catalogueRowCat}>{item.category}</span>
              <span style={styles.catalogueRowPrice}>{Number(item.price).toFixed(2)} DH</span>
              <button onClick={() => startEdit(item)} style={styles.iconBtnGhost}><Pencil size={13} /></button>
              <button onClick={() => deleteCatalogItem(item.id)} style={styles.iconBtnGhost}><Trash2 size={14} /></button>
            </div>
          )
        )}
      </div>
    </div>
  );
}

function ClientsAdmin({ clients, addClient, updateClient, deleteClient, orders, catalog, flash, canDelete }) {
  const [form, setForm] = useState({ denomination: "", ice: "", address: "", phone: "" });
  const [pricingId, setPricingId] = useState(null);
  const [priceDraft, setPriceDraft] = useState({});
  const [editingId, setEditingId] = useState(null);
  const [editDraft, setEditDraft] = useState({});

  const handleAddClient = async () => {
    if (!form.denomination.trim()) return flash("Dénomination requise");
    const client = {
      denomination: form.denomination.trim(),
      ice: form.ice.trim(),
      address: form.address.trim(),
      phone: form.phone.trim(),
      code: genCode(),
      prices: {},
    };
    const row = await addClient(client);
    setForm({ denomination: "", ice: "", address: "", phone: "" });
    if (row) flash(`Code créé : ${row.code}`);
  };
  const copyCode = (code) => { try { navigator.clipboard.writeText(code); flash("Code copié"); } catch { flash(code); } };

  const startEdit = (c) => { setEditingId(c.id); setEditDraft(c); };
  const saveEdit = () => {
    updateClient(editingId, { denomination: editDraft.denomination, ice: editDraft.ice, address: editDraft.address, phone: editDraft.phone });
    setEditingId(null);
    flash("Fiche mise à jour");
  };

  const openPricing = (client) => { setPricingId(client.id); setPriceDraft(client.prices || {}); };
  const savePricing = () => {
    const cleaned = {};
    Object.entries(priceDraft).forEach(([itemId, val]) => {
      if (val !== "" && val !== null && !isNaN(parseFloat(val))) cleaned[itemId] = parseFloat(val);
    });
    updateClient(pricingId, { prices: cleaned });
    setPricingId(null);
    flash("Tarifs mis à jour");
  };
  const pricingClient = clients.find((c) => c.id === pricingId);

  return (
    <div>
      <div style={styles.clientFormGrid}>
        <input placeholder="Dénomination sociale *" value={form.denomination} onChange={(e) => setForm({ ...form, denomination: e.target.value })} style={styles.addInput} />
        <input placeholder="ICE (facultatif)" value={form.ice} onChange={(e) => setForm({ ...form, ice: e.target.value })} style={styles.addInput} />
        <input placeholder="Adresse (facultatif)" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} style={styles.addInput} />
        <input placeholder="Téléphone (facultatif)" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} style={styles.addInput} />
        <button onClick={handleAddClient} style={styles.addBtn}><Plus size={16} /> Créer un accès</button>
      </div>

      <div style={styles.catalogueTable}>
        {clients.length === 0 && <div style={styles.emptyState}>Aucun client enregistré. Crée un accès pour ton premier client.</div>}
        {clients.map((c) => {
          const count = orders.filter((o) => o.clientId === c.id).length;
          const customCount = Object.keys(c.prices || {}).length;
          if (editingId === c.id) {
            return (
              <div key={c.id} style={styles.clientEditBox}>
                <input value={editDraft.denomination} onChange={(e) => setEditDraft({ ...editDraft, denomination: e.target.value })} style={styles.addInput} placeholder="Dénomination" />
                <input value={editDraft.ice || ""} onChange={(e) => setEditDraft({ ...editDraft, ice: e.target.value })} style={styles.addInput} placeholder="ICE" />
                <input value={editDraft.address || ""} onChange={(e) => setEditDraft({ ...editDraft, address: e.target.value })} style={styles.addInput} placeholder="Adresse" />
                <input value={editDraft.phone || ""} onChange={(e) => setEditDraft({ ...editDraft, phone: e.target.value })} style={styles.addInput} placeholder="Téléphone" />
                <button onClick={saveEdit} style={styles.primaryBtnSmall}>Enregistrer</button>
              </div>
            );
          }
          return (
            <div key={c.id} style={styles.clientRow}>
              <div style={{ flex: 1, minWidth: 160 }}>
                <div style={styles.catalogueRowName}>{c.denomination}</div>
                <div style={styles.orderMeta}>
                  {c.ice ? `ICE ${c.ice}` : "ICE non renseigné"} · {count} commande{count > 1 ? "s" : ""}
                  {customCount > 0 && ` · ${customCount} tarif${customCount > 1 ? "s" : ""} spécifique${customCount > 1 ? "s" : ""}`}
                </div>
              </div>
              <button onClick={() => startEdit(c)} style={styles.iconBtnGhost}><Pencil size={13} /></button>
              <button onClick={() => openPricing(c)} style={styles.tarifBtn}>Tarifs</button>
              <button onClick={() => copyCode(c.code)} style={styles.codeChip}><Copy size={11} /> {c.code}</button>
              {canDelete && <button onClick={() => deleteClient(c.id)} style={styles.iconBtnGhost}><Trash2 size={14} /></button>}
            </div>
          );
        })}
      </div>

      {pricingClient && (
        <div style={styles.modalOverlay} onClick={() => setPricingId(null)}>
          <div style={styles.modalBox} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHead}>
              <div style={styles.pinTitle}>Tarifs pour {pricingClient.denomination}</div>
              <button onClick={() => setPricingId(null)} style={styles.iconBtnGhost}><X size={18} /></button>
            </div>
            <div style={styles.modalNote}>Laisse vide pour garder le prix catalogue. Ce client ne voit jamais les prix des autres.</div>
            <div style={styles.modalList}>
              {catalog.map((item) => (
                <div key={item.id} style={styles.modalRow}>
                  <div style={{ flex: 1 }}>
                    <div style={styles.catalogueRowName}>{item.name}</div>
                    <div style={styles.orderMeta}>Prix catalogue : {Number(item.price).toFixed(2)} DH</div>
                  </div>
                  <input type="number" step="0.01" placeholder={Number(item.price).toFixed(2)}
                    value={priceDraft[item.id] ?? ""} onChange={(e) => setPriceDraft({ ...priceDraft, [item.id]: e.target.value })}
                    style={styles.modalPriceInput} />
                </div>
              ))}
              {catalog.length === 0 && <div style={styles.emptyState}>Ajoute d'abord des articles au catalogue.</div>}
            </div>
            <button onClick={savePricing} style={styles.primaryBtn}>Enregistrer les tarifs</button>
          </div>
        </div>
      )}
    </div>
  );
}

function StockAdmin({ catalog, rawMaterials, addRawMaterial, updateRawMaterial, deleteRawMaterial, restockRawMaterial, recipeItems, setRecipeForCatalogItem, produceStock, flash }) {
  const [sub, setSub] = useState("vue");

  const costOf = (catalogId) => {
    const items = recipeItems.filter((r) => r.catalog_id === catalogId);
    return items.reduce((sum, ri) => {
      const rm = rawMaterials.find((m) => m.id === ri.raw_material_id);
      return sum + (rm ? Number(rm.cost_per_unit) * Number(ri.quantity) : 0);
    }, 0);
  };

  return (
    <div>
      <div style={styles.subNavRow}>
        {[
          { k: "vue", label: "Vue d'ensemble" },
          { k: "matieres", label: "Matières premières" },
          { k: "recettes", label: "Recettes & coûts" },
        ].map((s) => (
          <button key={s.k} onClick={() => setSub(s.k)} style={{ ...styles.subNavBtn, ...(sub === s.k ? styles.subNavBtnActive : {}) }}>{s.label}</button>
        ))}
      </div>

      {sub === "vue" && <StockOverview catalog={catalog} rawMaterials={rawMaterials} costOf={costOf} produceStock={produceStock} />}
      {sub === "matieres" && <RawMaterialsAdmin rawMaterials={rawMaterials} addRawMaterial={addRawMaterial} updateRawMaterial={updateRawMaterial} deleteRawMaterial={deleteRawMaterial} restockRawMaterial={restockRawMaterial} flash={flash} />}
      {sub === "recettes" && <RecipesAdmin catalog={catalog} rawMaterials={rawMaterials} recipeItems={recipeItems} setRecipeForCatalogItem={setRecipeForCatalogItem} costOf={costOf} flash={flash} />}
    </div>
  );
}

function StockOverview({ catalog, rawMaterials, costOf, produceStock }) {
  const [prodQty, setProdQty] = useState({});
  const lowStock = rawMaterials.filter((m) => Number(m.stock_quantity) <= Number(m.alert_threshold || 0));

  return (
    <div>
      {lowStock.length > 0 && (
        <div style={styles.alertBox}>
          <AlertTriangle size={15} />
          <span>{lowStock.length} matière{lowStock.length > 1 ? "s" : ""} première{lowStock.length > 1 ? "s" : ""} en stock bas : {lowStock.map((m) => m.name).join(", ")}</span>
        </div>
      )}

      <div style={styles.catLabel}>Stock produits finis</div>
      <div style={styles.catalogueTable}>
        {catalog.length === 0 && <div style={styles.emptyState}>Ajoute d'abord des produits au catalogue.</div>}
        {catalog.map((item) => {
          const cost = costOf(item.id);
          const price = Number(item.price);
          const margin = price - cost;
          return (
            <div key={item.id} style={styles.stockRow}>
              <div style={{ flex: 2, minWidth: 140 }}>
                <div style={styles.catalogueRowName}>{item.name}</div>
                <div style={styles.orderMeta}>
                  Coût {cost.toFixed(2)} DH · Prix {price.toFixed(2)} DH · Marge {margin.toFixed(2)} DH
                </div>
              </div>
              <div style={styles.stockQtyBadge}>{Number(item.stock_quantity || 0)} en stock</div>
              <input type="number" placeholder="Qté produite" value={prodQty[item.id] || ""} onChange={(e) => setProdQty({ ...prodQty, [item.id]: e.target.value })} style={{ ...styles.addInput, width: 90, flex: "0 0 90px" }} />
              <button onClick={() => { const q = parseFloat(prodQty[item.id]); if (q > 0) { produceStock(item, q); setProdQty({ ...prodQty, [item.id]: "" }); } }} style={styles.addBtn}>
                <PackagePlus size={15} /> Produire
              </button>
            </div>
          );
        })}
      </div>

      <div style={{ ...styles.catLabel, marginTop: 26 }}>Stock matières premières</div>
      <div style={styles.catalogueTable}>
        {rawMaterials.length === 0 && <div style={styles.emptyState}>Ajoute tes matières premières dans l'onglet dédié.</div>}
        {rawMaterials.map((m) => {
          const low = Number(m.stock_quantity) <= Number(m.alert_threshold || 0);
          return (
            <div key={m.id} style={styles.stockRow}>
              <div style={{ flex: 1 }}>
                <div style={styles.catalogueRowName}>{m.name}</div>
                <div style={styles.orderMeta}>{Number(m.cost_per_unit).toFixed(2)} DH / {m.unit}</div>
              </div>
              <div style={{ ...styles.stockQtyBadge, ...(low ? styles.stockQtyBadgeLow : {}) }}>
                {Number(m.stock_quantity)} {m.unit}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function RawMaterialsAdmin({ rawMaterials, addRawMaterial, updateRawMaterial, deleteRawMaterial, restockRawMaterial, flash }) {
  const [form, setForm] = useState({ name: "", unit: "kg", cost_per_unit: "", stock_quantity: "", alert_threshold: "" });
  const [restockDraft, setRestockDraft] = useState({});
  const [editingId, setEditingId] = useState(null);
  const [editDraft, setEditDraft] = useState({});

  const addItem = () => {
    if (!form.name.trim() || !form.cost_per_unit) return flash("Nom et coût unitaire requis");
    addRawMaterial({
      name: form.name.trim(), unit: form.unit.trim() || "unité",
      cost_per_unit: parseFloat(form.cost_per_unit),
      stock_quantity: parseFloat(form.stock_quantity) || 0,
      alert_threshold: parseFloat(form.alert_threshold) || 0,
    });
    setForm({ name: "", unit: "kg", cost_per_unit: "", stock_quantity: "", alert_threshold: "" });
  };
  const startEdit = (m) => { setEditingId(m.id); setEditDraft(m); };
  const saveEdit = () => {
    updateRawMaterial(editingId, {
      name: editDraft.name, unit: editDraft.unit,
      cost_per_unit: parseFloat(editDraft.cost_per_unit),
      alert_threshold: parseFloat(editDraft.alert_threshold) || 0,
    });
    setEditingId(null);
  };
  const doRestock = (m) => {
    const qty = parseFloat(restockDraft[m.id]);
    if (!qty) return;
    restockRawMaterial(m, qty);
    setRestockDraft({ ...restockDraft, [m.id]: "" });
  };

  return (
    <div>
      <div style={styles.clientFormGrid}>
        <input placeholder="Nom (ex: Mascarpone)" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} style={styles.addInput} />
        <input placeholder="Unité (kg, l, pièce…)" value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} style={styles.addInput} />
        <input placeholder="Coût / unité (DH)" type="number" step="0.01" value={form.cost_per_unit} onChange={(e) => setForm({ ...form, cost_per_unit: e.target.value })} style={styles.addInput} />
        <input placeholder="Stock initial" type="number" step="0.01" value={form.stock_quantity} onChange={(e) => setForm({ ...form, stock_quantity: e.target.value })} style={styles.addInput} />
        <input placeholder="Seuil d'alerte" type="number" step="0.01" value={form.alert_threshold} onChange={(e) => setForm({ ...form, alert_threshold: e.target.value })} style={styles.addInput} />
        <button onClick={addItem} style={styles.addBtn}><Plus size={16} /> Ajouter</button>
      </div>

      <div style={styles.catalogueTable}>
        {rawMaterials.length === 0 && <div style={styles.emptyState}>Aucune matière première enregistrée.</div>}
        {rawMaterials.map((m) => {
          if (editingId === m.id) {
            return (
              <div key={m.id} style={styles.clientEditBox}>
                <input value={editDraft.name} onChange={(e) => setEditDraft({ ...editDraft, name: e.target.value })} style={styles.addInput} placeholder="Nom" />
                <input value={editDraft.unit} onChange={(e) => setEditDraft({ ...editDraft, unit: e.target.value })} style={styles.addInput} placeholder="Unité" />
                <input type="number" step="0.01" value={editDraft.cost_per_unit} onChange={(e) => setEditDraft({ ...editDraft, cost_per_unit: e.target.value })} style={styles.addInput} placeholder="Coût/unité" />
                <input type="number" step="0.01" value={editDraft.alert_threshold || ""} onChange={(e) => setEditDraft({ ...editDraft, alert_threshold: e.target.value })} style={styles.addInput} placeholder="Seuil d'alerte" />
                <button onClick={saveEdit} style={styles.primaryBtnSmall}>Enregistrer</button>
              </div>
            );
          }
          const low = Number(m.stock_quantity) <= Number(m.alert_threshold || 0);
          return (
            <div key={m.id} style={styles.clientRow}>
              <div style={{ flex: 1, minWidth: 140 }}>
                <div style={styles.catalogueRowName}>{m.name}</div>
                <div style={styles.orderMeta}>{Number(m.cost_per_unit).toFixed(2)} DH / {m.unit}</div>
              </div>
              <div style={{ ...styles.stockQtyBadge, ...(low ? styles.stockQtyBadgeLow : {}) }}>{Number(m.stock_quantity)} {m.unit}</div>
              <input type="number" placeholder="+ Qté" value={restockDraft[m.id] || ""} onChange={(e) => setRestockDraft({ ...restockDraft, [m.id]: e.target.value })} style={{ ...styles.addInput, width: 70, flex: "0 0 70px" }} />
              <button onClick={() => doRestock(m)} style={styles.tarifBtn}>Réappro.</button>
              <button onClick={() => startEdit(m)} style={styles.iconBtnGhost}><Pencil size={13} /></button>
              <button onClick={() => deleteRawMaterial(m.id)} style={styles.iconBtnGhost}><Trash2 size={14} /></button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function RecipesAdmin({ catalog, rawMaterials, recipeItems, setRecipeForCatalogItem, costOf, flash }) {
  const [editingId, setEditingId] = useState(null);
  const [draftItems, setDraftItems] = useState([]);

  const openRecipe = (catalogId) => {
    const existing = recipeItems.filter((r) => r.catalog_id === catalogId).map((r) => ({ raw_material_id: r.raw_material_id, quantity: r.quantity }));
    setDraftItems(existing.length ? existing : [{ raw_material_id: "", quantity: "" }]);
    setEditingId(catalogId);
  };
  const addLine = () => setDraftItems([...draftItems, { raw_material_id: "", quantity: "" }]);
  const updateLine = (idx, patch) => setDraftItems(draftItems.map((l, i) => (i === idx ? { ...l, ...patch } : l)));
  const removeLine = (idx) => setDraftItems(draftItems.filter((_, i) => i !== idx));
  const save = () => {
    setRecipeForCatalogItem(editingId, draftItems.filter((l) => l.raw_material_id && l.quantity));
    setEditingId(null);
  };

  if (rawMaterials.length === 0) {
    return <div style={styles.emptyState}>Ajoute d'abord des matières premières avant de créer des recettes.</div>;
  }

  return (
    <div style={styles.catalogueTable}>
      {catalog.length === 0 && <div style={styles.emptyState}>Ajoute d'abord des produits au catalogue.</div>}
      {catalog.map((item) => {
        const items = recipeItems.filter((r) => r.catalog_id === item.id);
        const cost = costOf(item.id);
        const margin = Number(item.price) - cost;
        return (
          <div key={item.id} style={styles.catalogueRow}>
            <div style={{ flex: 1 }}>
              <div style={styles.catalogueRowName}>{item.name}</div>
              <div style={styles.orderMeta}>
                {items.length === 0 ? "Aucune recette définie" : `${items.length} ingrédient${items.length > 1 ? "s" : ""} · coût ${cost.toFixed(2)} DH · marge ${margin.toFixed(2)} DH`}
              </div>
            </div>
            <button onClick={() => openRecipe(item.id)} style={styles.tarifBtn}>{items.length ? "Modifier" : "Créer la recette"}</button>
          </div>
        );
      })}

      {editingId && (
        <div style={styles.modalOverlay} onClick={() => setEditingId(null)}>
          <div style={styles.modalBox} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHead}>
              <div style={styles.pinTitle}>Recette — {catalog.find((c) => c.id === editingId)?.name}</div>
              <button onClick={() => setEditingId(null)} style={styles.iconBtnGhost}><X size={18} /></button>
            </div>
            <div style={styles.modalNote}>Indique la quantité de chaque matière première nécessaire pour produire 1 unité.</div>
            <div style={styles.modalList}>
              {draftItems.map((line, idx) => (
                <div key={idx} style={styles.modalRow}>
                  <select value={line.raw_material_id} onChange={(e) => updateLine(idx, { raw_material_id: e.target.value })} style={styles.recipeSelect}>
                    <option value="">Choisir…</option>
                    {rawMaterials.map((m) => <option key={m.id} value={m.id}>{m.name} ({m.unit})</option>)}
                  </select>
                  <input type="number" step="0.001" placeholder="Qté" value={line.quantity} onChange={(e) => updateLine(idx, { quantity: e.target.value })} style={styles.modalPriceInput} />
                  <button onClick={() => removeLine(idx)} style={styles.iconBtnGhost}><X size={14} /></button>
                </div>
              ))}
            </div>
            <button onClick={addLine} style={{ ...styles.tarifBtn, marginBottom: 12 }}><Plus size={13} /> Ajouter un ingrédient</button>
            <button onClick={save} style={styles.primaryBtn}>Enregistrer la recette</button>
          </div>
        </div>
      )}
    </div>
  );
}

function SocieteAdmin({ company, isPrincipal, changeAdminPin, settings, updateNotificationSettings, flash }) {
  const rows = [
    ["Dénomination", company.name], ["ICE", company.ice], ["Registre de commerce", company.rc],
    ["Adresse", company.address], ["Téléphone", company.phone], ["Email", company.email],
  ];
  const [currentPin, setCurrentPin] = useState("");
  const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [tgToken, setTgToken] = useState(settings?.telegram_bot_token || "");
  const [tgChatId, setTgChatId] = useState(settings?.telegram_chat_id || "");
  const [notifyOrders, setNotifyOrders] = useState(settings?.whatsapp_notify_orders !== false);
  const [notifyStock, setNotifyStock] = useState(settings?.whatsapp_notify_stock !== false);

  const submitChangePin = async () => {
    if (newPin.trim().length < 4) return flash("4 caractères minimum");
    if (newPin !== confirmPin) return flash("Les deux codes ne correspondent pas");
    const ok = await changeAdminPin(newPin.trim());
    if (ok) { flash("Code d'accès mis à jour"); setCurrentPin(""); setNewPin(""); setConfirmPin(""); }
  };

  const saveTelegram = () => {
    updateNotificationSettings({
      telegram_bot_token: tgToken.trim(),
      telegram_chat_id: tgChatId.trim(),
      whatsapp_notify_orders: notifyOrders,
      whatsapp_notify_stock: notifyStock,
    });
  };

  return (
    <div>
      <div style={styles.societeBox}>
        <img src={company.logo} alt={company.name} style={styles.logoImgLarge} />
        <div style={styles.societeTable}>
          {rows.map(([label, val]) => (
            <div key={label} style={styles.societeRow}><span style={styles.societeLabel}>{label}</span><span style={styles.societeVal}>{val || "—"}</span></div>
          ))}
        </div>
        <div style={styles.societeNote}>Ces informations apparaissent en en-tête sur tes bons de livraison et factures.</div>
      </div>

      {isPrincipal && (
        <div style={{ ...styles.societeBox, marginTop: 18 }}>
          <div style={styles.catLabel}><KeyRound size={14} style={{ verticalAlign: "-2px", marginRight: 6 }} />Changer mon code d'accès</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 12 }}>
            <input type="password" placeholder="Nouveau code (4 caractères min.)" value={newPin} onChange={(e) => setNewPin(e.target.value)} style={styles.addInput} />
            <input type="password" placeholder="Confirmer le nouveau code" value={confirmPin} onChange={(e) => setConfirmPin(e.target.value)} style={styles.addInput} />
            <button onClick={submitChangePin} style={styles.primaryBtn}>Mettre à jour mon code</button>
          </div>
        </div>
      )}

      {isPrincipal && (
        <div style={{ ...styles.societeBox, marginTop: 18 }}>
          <div style={styles.catLabel}>Alertes Telegram</div>
          <div style={styles.societeNote}>
            Colle le token de ton bot et ton identifiant de discussion (obtenus via @BotFather et @userinfobot sur Telegram).
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 14 }}>
            <input placeholder="Token du bot (ex: 123456:ABC-defGhIJK…)" value={tgToken} onChange={(e) => setTgToken(e.target.value)} style={styles.addInput} />
            <input placeholder="Ton chat ID (ex: 123456789)" value={tgChatId} onChange={(e) => setTgChatId(e.target.value)} style={styles.addInput} />
            <label style={styles.checkboxRow}>
              <input type="checkbox" checked={notifyOrders} onChange={(e) => setNotifyOrders(e.target.checked)} />
              Alerte à chaque nouvelle commande
            </label>
            <label style={styles.checkboxRow}>
              <input type="checkbox" checked={notifyStock} onChange={(e) => setNotifyStock(e.target.checked)} />
              Alerte quand un produit/matière passe sous son seuil
            </label>
            <button onClick={saveTelegram} style={styles.primaryBtn}>Enregistrer</button>
          </div>
        </div>
      )}
    </div>
  );
}

function MembresAdmin({ adminUsers, addAdminMember, deleteAdminMember, activityLog, flash }) {
  const [name, setName] = useState("");

  const handleAdd = async () => {
    if (!name.trim()) return flash("Nom requis");
    const row = await addAdminMember({ name: name.trim(), code: genCode() });
    setName("");
    if (row) flash(`Code créé pour ${row.name} : ${row.code}`);
  };
  const copyCode = (code) => { try { navigator.clipboard.writeText(code); flash("Code copié"); } catch { flash(code); } };

  return (
    <div>
      <div style={styles.catLabel}>Membres (accès restreint)</div>
      <div style={styles.addItemRow}>
        <input placeholder="Nom du membre" value={name} onChange={(e) => setName(e.target.value)} style={styles.addInput} />
        <button onClick={handleAdd} style={styles.addBtn}><Plus size={16} /> Créer un accès</button>
      </div>
      <div style={styles.catalogueTable}>
        {adminUsers.length === 0 && <div style={styles.emptyState}>Aucun membre créé. Un membre a un accès restreint : il ne peut pas supprimer de client ni modifier les infos société.</div>}
        {adminUsers.map((m) => (
          <div key={m.id} style={styles.clientRow}>
            <div style={{ flex: 1 }}><div style={styles.catalogueRowName}>{m.name}</div></div>
            <button onClick={() => copyCode(m.code)} style={styles.codeChip}><Copy size={11} /> {m.code}</button>
            <button onClick={() => deleteAdminMember(m.id, m.name)} style={styles.iconBtnGhost}><Trash2 size={14} /></button>
          </div>
        ))}
      </div>

      <div style={{ ...styles.catLabel, marginTop: 26 }}>Historique des connexions et actions</div>
      <div style={styles.catalogueTable}>
        {activityLog.length === 0 && <div style={styles.emptyState}>Aucune activité enregistrée pour le moment.</div>}
        {activityLog.slice(0, 60).map((a) => (
          <div key={a.id} style={styles.activityRow}>
            <span style={{ ...styles.activityRoleDot, background: a.role === "principal" ? C.gold : "#6FA383" }} />
            <div style={{ flex: 1 }}>
              <span style={styles.catalogueRowName}>{a.admin_name}</span>
              <span style={styles.orderMeta}> — {a.action}</span>
            </div>
            <span style={styles.orderMeta}>{new Date(a.created_at).toLocaleString("fr-FR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ==================== DOCUMENT (BL / FACTURE) ====================
function DocumentModal({ company, order, type, client, onClose, onToggleVat }) {
  const isFacture = type === "facture";
  const docTitle = isFacture ? "FACTURE" : "BON DE LIVRAISON";
  const docNumber = isFacture ? order.factureNumber : order.blNumber;
  const docDate = isFacture ? order.factureDate : order.date;
  const vatAmount = order.total - order.total / 1.2;

  return (
    <div style={styles.modalOverlay} onClick={onClose}>
      <div style={styles.docModalBox} onClick={(e) => e.stopPropagation()}>
        <div style={styles.docModalActions}>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <button onClick={() => window.print()} style={styles.printBtn}><Printer size={14} /> Imprimer / PDF</button>
            {isFacture && onToggleVat && (
              <button onClick={() => onToggleVat(!order.vatIncluded)} style={order.vatIncluded ? styles.vatBtnActive : styles.vatBtn}>
                {order.vatIncluded ? "✓ TVA 20% affichée" : "Afficher TVA 20%"}
              </button>
            )}
          </div>
          <button onClick={onClose} style={styles.iconBtnGhost}><X size={20} /></button>
        </div>
        <div id="print-area" style={styles.docPaper}>
          <div style={styles.docHead}>
            <img src={company.logo} alt="" style={styles.docLogo} />
            <div style={styles.docCompanyBlock}>
              <div style={styles.docCompanyName}>{company.name}</div>
              <div style={styles.docCompanyLine}>{company.address}</div>
              <div style={styles.docCompanyLine}>ICE {company.ice} · RC {company.rc}</div>
              <div style={styles.docCompanyLine}>{company.phone} · {company.email}</div>
            </div>
          </div>
          <div style={styles.docTitleRow}>
            <div>
              <div style={styles.docTitle}>{docTitle}</div>
              <div style={styles.docNumber}>N° {docNumber || "—"}</div>
            </div>
            <div style={styles.docDate}>
              {docDate ? new Date(docDate).toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" }) : "—"}
            </div>
          </div>
          <div style={styles.docClientBlock}>
            <div style={styles.docClientLabel}>Client</div>
            <div style={styles.docClientName}>{order.denomination || client?.denomination || "—"}</div>
            {(order.ice || client?.ice) && <div style={styles.docCompanyLine}>ICE {order.ice || client?.ice}</div>}
            {(order.address || client?.address) && <div style={styles.docCompanyLine}>{order.address || client?.address}</div>}
            {(order.phone || client?.phone) && <div style={styles.docCompanyLine}>{order.phone || client?.phone}</div>}
          </div>
          <table style={styles.docTable}>
            <thead>
              <tr>
                <th style={styles.docTh}>Désignation</th>
                <th style={{ ...styles.docTh, textAlign: "center" }}>Qté</th>
                <th style={{ ...styles.docTh, textAlign: "right" }}>P.U.</th>
                <th style={{ ...styles.docTh, textAlign: "right" }}>Total</th>
              </tr>
            </thead>
            <tbody>
              {order.items.map((it, idx) => (
                <tr key={idx}>
                  <td style={styles.docTd}>{it.name}</td>
                  <td style={{ ...styles.docTd, textAlign: "center" }}>{it.qty}</td>
                  <td style={{ ...styles.docTd, textAlign: "right" }}>{it.price.toFixed(2)}</td>
                  <td style={{ ...styles.docTd, textAlign: "right" }}>{(it.price * it.qty).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={styles.docTotalRow}>
            <span>TOTAL {isFacture ? "TTC" : ""}</span>
            <span style={styles.docTotalVal}>{order.total.toFixed(2)} DH</span>
          </div>
          {isFacture && order.vatIncluded && (
            <div style={styles.docVatRow}>DONT TVA 20% : {vatAmount.toFixed(2)} DH</div>
          )}
          {order.notes && <div style={styles.docNotes}>Notes : {order.notes}</div>}
          <div style={styles.docFooter}>
            {isFacture ? "Facture générée après livraison." : "Bon de livraison — la facture sera établie après livraison."}
          </div>
        </div>
      </div>
    </div>
  );
}

// ==================== CLIENT APP ====================
const effectivePrice = (item, client) =>
  client.prices && client.prices[item.id] !== undefined ? Number(client.prices[item.id]) : Number(item.price);

function ClientApp({ company, client, onUpdateClient, catalog, orders, onSubmitOrder, onLogout, flash }) {
  const [view, setView] = useState("commander");
  const [lines, setLines] = useState([]);
  const [notes, setNotes] = useState("");
  const [search, setSearch] = useState("");
  const [docView, setDocView] = useState(null);
  const [profileDraft, setProfileDraft] = useState({ address: client.address || "", phone: client.phone || "" });
  const [submitting, setSubmitting] = useState(false);

  const addLine = (item) => {
    const price = effectivePrice(item, client);
    setLines((prev) => {
      const found = prev.find((l) => l.id === item.id);
      if (found) return prev.map((l) => (l.id === item.id ? { ...l, qty: l.qty + 1 } : l));
      return [...prev, { id: item.id, name: item.name, price, qty: 1 }];
    });
  };
  const changeQty = (id, delta) => setLines((prev) => prev.map((l) => (l.id === id ? { ...l, qty: l.qty + delta } : l)).filter((l) => l.qty > 0));
  const setQty = (id, value) => {
    const qty = parseInt(value, 10);
    setLines((prev) => {
      if (!qty || qty <= 0) return prev.filter((l) => l.id !== id);
      return prev.map((l) => (l.id === id ? { ...l, qty } : l));
    });
  };
  const removeLine = (id) => setLines((prev) => prev.filter((l) => l.id !== id));
  const total = lines.reduce((s, l) => s + l.price * l.qty, 0);

  const submit = async () => {
    if (lines.length === 0) return flash("Ajoute au moins un article");
    setSubmitting(true);
    const ok = await onSubmitOrder({
      clientId: client.id,
      denomination: client.denomination,
      ice: client.ice,
      address: client.address,
      phone: client.phone,
      notes: notes.trim(),
      items: lines,
      total,
    });
    setSubmitting(false);
    if (ok) {
      flash("Commande envoyée à ton traiteur !");
      setLines([]); setNotes("");
      setView("historique");
    }
  };

  const [logoUploading, setLogoUploading] = useState(false);
  const saveProfile = async () => {
    await onUpdateClient({ address: profileDraft.address.trim(), phone: profileDraft.phone.trim() });
    flash("Coordonnées mises à jour");
  };
  const handleLogoChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLogoUploading(true);
    try {
      const dataUrl = await fileToCompressedImage(file, 300, 0.75);
      await onUpdateClient({ logo_url: dataUrl });
      flash("Logo mis à jour");
    } catch { flash("Échec de l'envoi du logo"); }
    setLogoUploading(false);
  };

  const filtered = catalog.filter((c) => c.name.toLowerCase().includes(search.toLowerCase()));
  const categories = [...new Set(filtered.map((c) => c.category))];

  return (
    <div style={styles.shell}>
      <header style={styles.header}>
        <div style={styles.headerLeft}>
          <img src={client.logo_url || company.logo} alt="" style={styles.logoImgSmall} />
          <div>
            <div style={styles.brand}>{client.denomination}</div>
            <div style={styles.brandSub}>Espace client</div>
          </div>
        </div>
        <button onClick={onLogout} style={styles.logoutBtn}><LogOut size={15} /></button>
      </header>
      <nav style={styles.navRow}>
        <button onClick={() => setView("commander")} style={{ ...styles.navBtn, ...(view === "commander" ? styles.navBtnActive : {}) }}>Commander</button>
        <button onClick={() => setView("historique")} style={{ ...styles.navBtn, ...(view === "historique" ? styles.navBtnActive : {}) }}>
          Mes commandes {orders.length > 0 && <span style={styles.navBadge}>{orders.length}</span>}
        </button>
        <button onClick={() => setView("profil")} style={{ ...styles.navBtn, ...(view === "profil" ? styles.navBtnActive : {}) }}><User size={13} /> Profil</button>
      </nav>

      <main style={styles.main}>
        {view === "commander" && (
          <div style={styles.orderLayout}>
            <section>
              <div style={styles.deliveryNotice}>
                <Clock size={15} />
                <span>Commande passée avant <b>13h</b> : traitée et livrée le <b>jour même</b>. Après 13h : traitée et livrée le <b>lendemain</b>.</span>
              </div>
              <div style={styles.searchRow}>
                <Search size={16} color="#8B93A0" />
                <input placeholder="Chercher un plat…" value={search} onChange={(e) => setSearch(e.target.value)} style={styles.searchInput} />
              </div>
              {categories.length === 0 && <div style={styles.emptyState}>Le menu n'est pas encore disponible.</div>}
              {categories.map((cat) => (
                <div key={cat} style={{ marginBottom: 22 }}>
                  <div style={styles.catLabel}>{cat}</div>
                  <div style={styles.itemGrid}>
                    {filtered.filter((c) => c.category === cat).map((item) => (
                      <button key={item.id} onClick={() => addLine(item)} style={styles.itemCard}>
                        {item.image_url && <img src={item.image_url} alt="" style={styles.itemCardImage} />}
                        <span style={styles.itemName}>{item.name}</span>
                        <span style={styles.itemPrice}>{effectivePrice(item, client).toFixed(2)} DH</span>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </section>
            <section style={{ display: "flex", justifyContent: "center" }}>
              <div style={styles.cartBox}>
                <div style={styles.cartHead}>Ma commande</div>
                <div style={styles.ticketLines}>
                  {lines.length === 0 ? (
                    <div style={styles.ticketEmpty}>Touche un article à gauche pour l'ajouter</div>
                  ) : lines.map((l) => (
                    <div key={l.id} style={styles.ticketLine}>
                      <div style={styles.ticketLineTop}>
                        <span style={styles.ticketLineName}>{l.name}</span>
                        <button onClick={() => removeLine(l.id)} style={styles.iconBtnGhost}><X size={13} /></button>
                      </div>
                      <div style={styles.ticketLineBottom}>
                        <div style={styles.qtyControl}>
                          <button onClick={() => changeQty(l.id, -1)} style={styles.qtyBtn}><Minus size={12} /></button>
                          <input
                            type="number"
                            min="1"
                            value={l.qty}
                            onChange={(e) => setQty(l.id, e.target.value)}
                            onFocus={(e) => e.target.select()}
                            style={styles.qtyInput}
                          />
                          <button onClick={() => changeQty(l.id, 1)} style={styles.qtyBtn}><Plus size={12} /></button>
                        </div>
                        <span style={styles.ticketLinePrice}>{(l.price * l.qty).toFixed(2)} DH</span>
                      </div>
                    </div>
                  ))}
                </div>
                <textarea placeholder="Notes (allergies, livraison…)" value={notes} onChange={(e) => setNotes(e.target.value)} style={styles.ticketNotes} rows={2} />
                <div style={styles.cartDivider} />
                <div style={styles.ticketTotalRow}><span>TOTAL</span><span style={styles.ticketTotalVal}>{total.toFixed(2)} DH</span></div>
                <button onClick={submit} disabled={submitting} style={styles.primaryBtn}>{submitting ? "Envoi…" : "Envoyer la commande"}</button>
              </div>
            </section>
          </div>
        )}

        {view === "historique" && (
          <div style={styles.historyList}>
            {orders.length === 0 && <div style={styles.emptyState}>Tu n'as pas encore passé de commande.</div>}
            {orders.map((o) => {
              const st = STATUS[o.status];
              return (
                <div key={o.id} style={styles.orderCard}>
                  <div style={styles.orderCardHead}>
                    <div style={styles.orderMeta}>{o.blNumber} · {new Date(o.date).toLocaleString("fr-FR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</div>
                    <span style={{ ...styles.statusPill, color: st.color, background: st.bg }}>
                      {o.status === "livree" ? <Check size={12} /> : <Clock size={12} />} {st.label}
                    </span>
                  </div>
                  <div style={styles.orderItems}>
                    {o.items.map((it, idx) => (
                      <div key={idx} style={styles.orderItemRow}><span>{it.qty}× {it.name}</span><span>{(it.price * it.qty).toFixed(2)} DH</span></div>
                    ))}
                  </div>
                  <div style={styles.orderCardFoot}>
                    <span style={styles.orderTotal}>{o.total.toFixed(2)} DH</span>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button onClick={() => setDocView({ order: o, type: "bl" })} style={styles.docBtn}><Truck size={12} /> Bon de livraison</button>
                      {o.factureNumber && <button onClick={() => setDocView({ order: o, type: "facture" })} style={styles.docBtnAccent}><Receipt size={12} /> Facture</button>}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {view === "profil" && (
          <div style={styles.societeBox}>
            <div style={styles.societeTable}>
              <div style={styles.societeRow}><span style={styles.societeLabel}>Dénomination</span><span style={styles.societeVal}>{client.denomination}</span></div>
              <div style={styles.societeRow}><span style={styles.societeLabel}>ICE</span><span style={styles.societeVal}>{client.ice || "Non renseigné"}</span></div>
            </div>
            <div style={styles.societeNote}>Ces informations sont gérées par ton traiteur. Tu peux compléter tes coordonnées ci-dessous.</div>

            <div style={styles.logoUploadRow}>
              <label style={styles.logoUploadBtn}>
                {client.logo_url ? <img src={client.logo_url} alt="" style={styles.logoUploadPreview} /> : <span style={{ fontSize: 11, color: C.textMuted }}>Ajouter mon logo</span>}
                <input type="file" accept="image/*" onChange={handleLogoChange} style={{ display: "none" }} />
              </label>
              <div style={styles.orderMeta}>{logoUploading ? "Envoi en cours…" : "Clique sur le cadre pour ajouter ou changer ton logo."}</div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 16 }}>
              <input placeholder="Adresse" value={profileDraft.address} onChange={(e) => setProfileDraft({ ...profileDraft, address: e.target.value })} style={styles.addInput} />
              <input placeholder="Téléphone" value={profileDraft.phone} onChange={(e) => setProfileDraft({ ...profileDraft, phone: e.target.value })} style={styles.addInput} />
              <button onClick={saveProfile} style={styles.primaryBtn}>Enregistrer</button>
            </div>
          </div>
        )}
      </main>
      {docView && <DocumentModal company={company} order={docView.order} type={docView.type} client={client} onClose={() => setDocView(null)} />}
    </div>
  );
}

// ==================== STYLES — thème sombre & élégant ====================
const C = {
  bg: "#14171C", bgHead: "#0F1216", surface: "#1C2027", surfaceAlt: "#22262E",
  border: "#2B3038", borderLight: "#383E48", text: "#EDEFF2", textMuted: "#9BA2AF",
  textFaint: "#5C636E", gold: "#C9A15A", goldSoft: "rgba(201,161,90,0.12)", danger: "#C0524A",
};

const styles = {
  app: { minHeight: "100vh", background: C.bg, fontFamily: "'Inter', system-ui, sans-serif", color: C.text },
  loadingScreen: { minHeight: "100vh", background: C.bgHead, display: "flex", alignItems: "center", justifyContent: "center" },
  loadingTicket: { width: 40, height: 40, border: `3px solid ${C.gold}`, borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.8s linear infinite" },

  landingWrap: { minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 24, padding: 20, position: "relative", background: `radial-gradient(circle at 50% 0%, #1B2029 0%, ${C.bg} 60%)` },
  landingBrand: { display: "flex", flexDirection: "column", alignItems: "center", gap: 8, marginBottom: 4 },
  landingTitle: { fontFamily: "'Fraunces', serif", fontWeight: 600, fontSize: 28, letterSpacing: 0.5, color: C.text },
  landingSub: { fontSize: 13, color: C.textMuted, letterSpacing: 0.5 },
  logoImg: { width: 84, height: 84, objectFit: "contain" },
  logoImgSmall: { width: 30, height: 30, objectFit: "contain" },
  logoImgLarge: { width: 120, height: 120, objectFit: "contain", display: "block", margin: "0 auto 18px" },
  landingFooter: { position: "absolute", bottom: 20, textAlign: "center", fontSize: 11, color: C.textFaint, lineHeight: 1.7, display: "flex", flexDirection: "column", alignItems: "center", gap: 6 },
  adminLink: { background: "none", border: "none", color: C.textFaint, fontSize: 10.5, textDecoration: "underline", cursor: "pointer", padding: 0, marginTop: 4 },
  backBtn: { position: "absolute", top: 22, left: 22, background: "none", border: "none", color: C.textMuted, fontSize: 13, display: "flex", alignItems: "center", gap: 6, cursor: "pointer" },

  pinBox: { background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, padding: "30px 28px", width: "100%", maxWidth: 340, display: "flex", flexDirection: "column", gap: 10, boxShadow: "0 20px 50px rgba(0,0,0,0.4)" },
  pinTitle: { fontFamily: "'Fraunces', serif", fontWeight: 600, fontSize: 19, color: C.text },
  pinSub: { fontSize: 12.5, color: C.textMuted, marginBottom: 6 },
  pinInput: { border: `1px solid ${C.border}`, borderRadius: 10, padding: "13px 14px", fontSize: 16, textAlign: "center", outline: "none", background: C.bgHead, color: C.text },
  errorText: { fontSize: 12, color: C.danger },

  shell: { display: "flex", flexDirection: "column", minHeight: "100vh" },
  header: { background: C.bgHead, padding: "16px 20px", display: "flex", justifyContent: "space-between", alignItems: "center", position: "sticky", top: 0, zIndex: 10, borderBottom: `1px solid ${C.border}` },
  headerLeft: { display: "flex", alignItems: "center", gap: 10 },
  brand: { fontFamily: "'Fraunces', serif", fontWeight: 600, fontSize: 17, color: C.text, lineHeight: 1.2 },
  brandSub: { fontSize: 11, color: C.textFaint, letterSpacing: 0.4, marginTop: 2 },
  logoutBtn: { background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, padding: 9, color: C.textMuted, cursor: "pointer", display: "flex" },
  navRow: { display: "flex", gap: 8, padding: "12px 20px", background: C.bgHead, borderBottom: `1px solid ${C.border}` },
  backIconBtn: { background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, padding: 8, color: C.text, cursor: "pointer", display: "flex" },
  moduleGrid: { display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 12 },
  moduleCard: {
    position: "relative", background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16,
    padding: "22px 16px", display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 8,
    cursor: "pointer", textAlign: "left", minHeight: 118,
  },
  moduleCardLabel: { fontFamily: "'Fraunces', serif", fontWeight: 600, fontSize: 15.5, color: C.text, marginTop: 2 },
  moduleCardDesc: { fontSize: 11.5, color: C.textFaint },
  moduleBadge: { position: "absolute", top: 12, right: 12, background: C.danger, color: "#fff", fontSize: 11, fontWeight: 700, borderRadius: 20, padding: "2px 8px", minWidth: 18, textAlign: "center" },
  subNavRow: { display: "flex", gap: 8, marginBottom: 18, flexWrap: "wrap" },
  subNavBtn: { background: C.surface, border: `1px solid ${C.border}`, color: C.textMuted, borderRadius: 8, padding: "8px 13px", fontSize: 12.5, fontWeight: 600, cursor: "pointer" },
  subNavBtnActive: { background: C.gold, borderColor: C.gold, color: "#1A1508" },
  stockRow: { display: "flex", alignItems: "center", flexWrap: "wrap", gap: 10, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: "11px 13px" },
  stockQtyBadge: { fontFamily: "'Space Mono', monospace", fontSize: 12.5, background: C.surfaceAlt, border: `1px solid ${C.border}`, borderRadius: 7, padding: "6px 10px", color: C.text, whiteSpace: "nowrap" },
  stockQtyBadgeLow: { color: C.danger, borderColor: C.danger, background: "rgba(192,82,74,0.12)" },
  alertBox: { display: "flex", alignItems: "center", gap: 8, background: "rgba(192,82,74,0.12)", border: `1px solid ${C.danger}`, color: C.danger, borderRadius: 10, padding: "11px 14px", fontSize: 12.5, marginBottom: 20 },
  recipeSelect: { flex: 1, border: `1px solid ${C.border}`, borderRadius: 7, padding: "8px 9px", fontSize: 13, background: C.bgHead, color: C.text, outline: "none" },
  navBtn: { flex: 1, background: "transparent", border: `1px solid ${C.border}`, color: C.textMuted, borderRadius: 9, padding: "9px 10px", fontSize: 12.5, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 },
  navBtnActive: { background: C.gold, borderColor: C.gold, color: "#1A1508" },
  navBadge: { background: "rgba(0,0,0,0.3)", borderRadius: 10, fontSize: 10, padding: "1px 6px" },
  main: { flex: 1, padding: 16, maxWidth: 980, margin: "0 auto", width: "100%", boxSizing: "border-box" },

  orderLayout: { display: "flex", flexDirection: "column", gap: 20 },
  searchRow: { display: "flex", alignItems: "center", gap: 8, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: "10px 12px", marginBottom: 18 },
  searchInput: { border: "none", background: "transparent", outline: "none", fontSize: 14, flex: 1, color: C.text },
  catLabel: { fontFamily: "'Fraunces', serif", fontWeight: 600, fontSize: 15, letterSpacing: 0.3, color: C.gold, marginBottom: 8, borderBottom: `1px solid ${C.border}`, paddingBottom: 6 },
  itemGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 8 },
  itemCard: { background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: "13px 13px", textAlign: "left", cursor: "pointer", display: "flex", flexDirection: "column", gap: 5 },
  itemName: { fontSize: 13.5, fontWeight: 600, lineHeight: 1.3, color: C.text },
  itemCardImage: { width: "100%", height: 84, objectFit: "cover", borderRadius: 7, marginBottom: 2 },
  itemPrice: { fontFamily: "'Space Mono', monospace", fontSize: 13, color: C.gold },

  cartBox: { background: C.surface, border: `1px solid ${C.border}`, width: "100%", maxWidth: 420, borderRadius: 14, padding: "22px 20px 20px", boxShadow: "0 12px 34px rgba(0,0,0,0.35)" },
  cartHead: { fontFamily: "'Fraunces', serif", fontWeight: 600, fontSize: 18, color: C.text, marginBottom: 14 },
  cartDivider: { borderTop: `1px solid ${C.border}`, margin: "12px 0" },
  ticketLines: { display: "flex", flexDirection: "column", gap: 10, minHeight: 40 },
  ticketEmpty: { fontSize: 12.5, color: C.textFaint, textAlign: "center", padding: "10px 0" },
  ticketLine: { display: "flex", flexDirection: "column", gap: 5, borderBottom: `1px solid ${C.border}`, paddingBottom: 10 },
  ticketLineTop: { display: "flex", justifyContent: "space-between", alignItems: "center" },
  ticketLineName: { fontSize: 13.5, fontWeight: 600, color: C.text },
  ticketLineBottom: { display: "flex", justifyContent: "space-between", alignItems: "center" },
  qtyControl: { display: "flex", alignItems: "center", gap: 8 },
  qtyBtn: { width: 23, height: 23, borderRadius: "50%", border: `1px solid ${C.borderLight}`, background: C.surfaceAlt, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: C.text },
  qtyVal: { fontFamily: "'Space Mono', monospace", fontSize: 13, minWidth: 14, textAlign: "center", color: C.text },
  deliveryNotice: { display: "flex", alignItems: "flex-start", gap: 8, background: C.goldSoft, border: `1px solid ${C.gold}`, borderRadius: 10, padding: "11px 13px", fontSize: 12.5, color: C.text, lineHeight: 1.5, marginBottom: 18 },
  qtyInput: {
    width: 40, fontFamily: "'Space Mono', monospace", fontSize: 13, textAlign: "center", color: C.text,
    background: C.bgHead, border: `1px solid ${C.borderLight}`, borderRadius: 6, padding: "3px 2px", outline: "none",
  },
  ticketLinePrice: { fontFamily: "'Space Mono', monospace", fontSize: 13, color: C.text },
  iconBtnGhost: { background: "none", border: "none", color: C.gold, cursor: "pointer", padding: 2, display: "flex" },
  ticketNotes: { width: "100%", boxSizing: "border-box", border: `1px solid ${C.border}`, borderRadius: 8, background: C.bgHead, padding: 9, fontSize: 12.5, color: C.text, resize: "none", outline: "none", marginTop: 8 },
  ticketTotalRow: { display: "flex", justifyContent: "space-between", alignItems: "baseline", fontFamily: "'Fraunces', serif", fontWeight: 600, fontSize: 16, color: C.text },
  ticketTotalVal: { fontFamily: "'Space Mono', monospace", fontSize: 20, color: C.gold },

  primaryBtn: { width: "100%", marginTop: 14, background: C.gold, color: "#1A1508", border: "none", borderRadius: 9, padding: "13px 0", fontSize: 14, fontWeight: 700, cursor: "pointer", letterSpacing: 0.3 },
  primaryBtnSmall: { background: C.gold, color: "#1A1508", border: "none", borderRadius: 8, padding: "9px 14px", fontSize: 12.5, fontWeight: 700, cursor: "pointer" },

  historyList: { display: "flex", flexDirection: "column", gap: 12 },
  orderCard: { background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: 16 },
  orderCardHead: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 },
  orderClient: { fontSize: 15.5, fontWeight: 700, display: "flex", alignItems: "center", gap: 6, color: C.text },
  newDot: { width: 7, height: 7, borderRadius: "50%", background: C.danger, display: "inline-block" },
  orderMeta: { fontSize: 12, color: C.textFaint, marginTop: 2 },
  statusPill: { border: "none", borderRadius: 20, padding: "5px 11px", fontSize: 11.5, fontWeight: 700, display: "flex", alignItems: "center", gap: 5, cursor: "pointer" },
  orderItems: { display: "flex", flexDirection: "column", gap: 4, marginBottom: 8 },
  orderItemRow: { display: "flex", justifyContent: "space-between", fontSize: 13, color: C.textMuted },
  orderNotes: { fontSize: 12, color: C.gold, fontStyle: "italic", marginBottom: 8 },
  orderCardFoot: { display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: `1px solid ${C.border}`, paddingTop: 10, flexWrap: "wrap", gap: 8 },
  orderTotal: { fontFamily: "'Space Mono', monospace", fontSize: 16, fontWeight: 700, color: C.gold },
  deleteBtn: { background: "none", border: "none", color: C.danger, fontSize: 12, display: "flex", alignItems: "center", gap: 4, cursor: "pointer" },
  docBtn: { background: C.surfaceAlt, border: `1px solid ${C.border}`, borderRadius: 7, padding: "6px 10px", fontSize: 11.5, color: C.textMuted, display: "flex", alignItems: "center", gap: 5, cursor: "pointer", fontWeight: 600 },
  docBtnAccent: { background: C.goldSoft, border: `1px solid ${C.gold}`, borderRadius: 7, padding: "6px 10px", fontSize: 11.5, color: C.gold, display: "flex", alignItems: "center", gap: 5, cursor: "pointer", fontWeight: 700 },
  emptyState: { textAlign: "center", color: C.textFaint, fontSize: 13.5, padding: "40px 0" },

  addItemRow: { display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap" },
  clientFormGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 8, marginBottom: 20 },
  addInput: { flex: 1, minWidth: 100, border: `1px solid ${C.border}`, borderRadius: 8, padding: "10px 11px", fontSize: 13.5, outline: "none", background: C.surface, color: C.text },
  imageUploadBtn: { width: 44, height: 44, minWidth: 44, borderRadius: 8, border: `1px dashed ${C.border}`, background: C.surface, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", overflow: "hidden", color: C.textMuted, textAlign: "center" },
  imageThumb: { width: 44, height: 44, objectFit: "cover", borderRadius: 7 },
  imageThumbEmpty: { width: 32, height: 32, borderRadius: 6, background: C.surfaceAlt, border: `1px dashed ${C.border}` },
  logoUploadRow: { display: "flex", alignItems: "center", gap: 14, marginTop: 16 },
  logoUploadBtn: { width: 72, height: 72, borderRadius: 12, border: `1px dashed ${C.border}`, background: C.surfaceAlt, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", overflow: "hidden", textAlign: "center", padding: 4 },
  logoUploadPreview: { width: "100%", height: "100%", objectFit: "contain" },
  addBtn: { background: C.gold, color: "#1A1508", border: "none", borderRadius: 8, padding: "10px 14px", fontSize: 13, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", gap: 5, cursor: "pointer" },
  catalogueTable: { display: "flex", flexDirection: "column", gap: 6 },
  catalogueRow: { display: "flex", alignItems: "center", gap: 10, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: "11px 13px" },
  clientRow: { display: "flex", alignItems: "center", flexWrap: "wrap", gap: 10, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: "11px 13px" },
  activityRow: { display: "flex", alignItems: "center", gap: 10, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 9, padding: "9px 12px" },
  activityRoleDot: { width: 8, height: 8, borderRadius: "50%", flexShrink: 0 },
  clientEditBox: { display: "flex", flexDirection: "column", gap: 8, background: C.surfaceAlt, border: `1px solid ${C.gold}`, borderRadius: 10, padding: 12 },
  catalogueRowName: { flex: 2, fontSize: 13.5, fontWeight: 600, color: C.text },
  catalogueRowCat: { flex: 1, fontSize: 12, color: C.textMuted },
  catalogueRowPrice: { fontFamily: "'Space Mono', monospace", fontSize: 13, width: 70, textAlign: "right", color: C.text },
  tarifBtn: { background: C.surfaceAlt, border: `1px solid ${C.border}`, borderRadius: 7, padding: "7px 11px", fontSize: 12, fontWeight: 700, color: C.gold, cursor: "pointer" },
  codeChip: { fontFamily: "'Space Mono', monospace", fontSize: 12, background: C.bgHead, border: `1px solid ${C.border}`, borderRadius: 7, padding: "6px 9px", display: "flex", alignItems: "center", gap: 6, cursor: "pointer", color: C.text },

  modalOverlay: { position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: 16 },
  modalBox: { background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, padding: 22, width: "100%", maxWidth: 440, maxHeight: "85vh", display: "flex", flexDirection: "column", boxShadow: "0 20px 60px rgba(0,0,0,0.5)" },
  modalHead: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 },
  modalNote: { fontSize: 12, color: C.textMuted, marginBottom: 14 },
  modalList: { display: "flex", flexDirection: "column", gap: 8, overflowY: "auto", marginBottom: 16 },
  modalRow: { display: "flex", alignItems: "center", gap: 10, background: C.surfaceAlt, border: `1px solid ${C.border}`, borderRadius: 9, padding: "9px 11px" },
  modalPriceInput: { width: 74, border: `1px solid ${C.border}`, borderRadius: 7, padding: "7px 8px", fontSize: 13, fontFamily: "'Space Mono', monospace", textAlign: "right", outline: "none", background: C.bgHead, color: C.text },

  societeBox: { background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14, padding: "24px 22px", maxWidth: 480, margin: "0 auto" },
  societeTable: { display: "flex", flexDirection: "column", gap: 10 },
  societeRow: { display: "flex", justifyContent: "space-between", gap: 12, borderBottom: `1px dashed ${C.border}`, paddingBottom: 8 },
  societeLabel: { fontSize: 12.5, color: C.textMuted, fontWeight: 600 },
  societeVal: { fontSize: 13, textAlign: "right", maxWidth: "60%", color: C.text },
  societeNote: { fontSize: 12, color: C.gold, fontStyle: "italic", marginTop: 14, textAlign: "center" },
  checkboxRow: { display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: C.text },

  docModalBox: { background: "#fff", borderRadius: 14, padding: 0, width: "100%", maxWidth: 560, maxHeight: "92vh", overflow: "auto", boxShadow: "0 20px 60px rgba(0,0,0,0.5)" },
  docModalActions: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 20px", background: "#F4F2ED", position: "sticky", top: 0 },
  printBtn: { background: "#1A1D22", color: "#fff", border: "none", borderRadius: 8, padding: "9px 14px", fontSize: 12.5, fontWeight: 700, display: "flex", alignItems: "center", gap: 6, cursor: "pointer" },
  vatBtn: { background: "#fff", color: "#1A1D22", border: "1px solid #ccc", borderRadius: 8, padding: "9px 12px", fontSize: 12, fontWeight: 600, cursor: "pointer" },
  vatBtnActive: { background: "#e3f0e8", color: "#1F5C3A", border: "1px solid #6FA383", borderRadius: 8, padding: "9px 12px", fontSize: 12, fontWeight: 700, cursor: "pointer" },
  docVatRow: { textAlign: "right", fontSize: 12, color: "#555", marginTop: 4 },
  docPaper: { padding: "30px 32px 36px", color: "#1A1D22", fontFamily: "'Inter', sans-serif" },
  docHead: { display: "flex", alignItems: "center", gap: 16, borderBottom: "2px solid #1A1D22", paddingBottom: 18, marginBottom: 18 },
  docLogo: { width: 58, height: 58, objectFit: "contain" },
  docCompanyBlock: { display: "flex", flexDirection: "column", gap: 2 },
  docCompanyName: { fontFamily: "'Fraunces', serif", fontWeight: 700, fontSize: 16 },
  docCompanyLine: { fontSize: 11, color: "#555" },
  docTitleRow: { display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 20 },
  docTitle: { fontFamily: "'Fraunces', serif", fontWeight: 700, fontSize: 22, letterSpacing: 1 },
  docNumber: { fontFamily: "'Space Mono', monospace", fontSize: 13, color: "#555", marginTop: 4 },
  docDate: { fontSize: 12.5, color: "#555" },
  docClientBlock: { background: "#F7F5F0", borderRadius: 8, padding: "12px 16px", marginBottom: 20 },
  docClientLabel: { fontSize: 10.5, textTransform: "uppercase", letterSpacing: 1, color: "#8A8577", marginBottom: 4 },
  docClientName: { fontWeight: 700, fontSize: 14, marginBottom: 2 },
  docTable: { width: "100%", borderCollapse: "collapse", marginBottom: 16 },
  docTh: { textAlign: "left", fontSize: 11, textTransform: "uppercase", letterSpacing: 0.5, color: "#8A8577", borderBottom: "1px solid #DDD", padding: "6px 4px" },
  docTd: { fontSize: 13, padding: "8px 4px", borderBottom: "1px solid #EEE" },
  docTotalRow: { display: "flex", justifyContent: "flex-end", gap: 14, alignItems: "baseline", fontFamily: "'Fraunces', serif", fontWeight: 700, fontSize: 16, borderTop: "2px solid #1A1D22", paddingTop: 12 },
  docTotalVal: { fontFamily: "'Space Mono', monospace", fontSize: 19 },
  docNotes: { fontSize: 12, color: "#555", marginTop: 14, fontStyle: "italic" },
  docFooter: { fontSize: 10.5, color: "#999", marginTop: 24, textAlign: "center" },

  toast: { position: "fixed", bottom: 20, left: "50%", transform: "translateX(-50%)", background: C.surfaceAlt, color: C.text, border: `1px solid ${C.border}`, padding: "10px 18px", borderRadius: 9, fontSize: 13, boxShadow: "0 10px 30px rgba(0,0,0,0.4)" },
};
