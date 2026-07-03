import ExcelJS from "exceljs"

export async function buildAssetsWorkbook(assets: any[]) {
  const workbook = new ExcelJS.Workbook()
  workbook.creator = "AssetFlow"
  workbook.created = new Date()

  const sheet = workbook.addWorksheet("Assets")

  sheet.columns = [
    { header: "Asset ID", key: "assetId", width: 12 },
    { header: "Name", key: "assetName", width: 28 },
    { header: "Category", key: "category", width: 14 },
    { header: "Brand", key: "brand", width: 14 },
    { header: "Model", key: "model", width: 18 },
    { header: "Serial Number", key: "serialNumber", width: 20 },
    { header: "Status", key: "status", width: 12 },
    { header: "Condition", key: "condition", width: 14 },
    { header: "Branch", key: "branch", width: 18 },
    { header: "Assigned To", key: "assignedTo", width: 22 },
    { header: "Assigned Email", key: "assignedEmail", width: 26 },
    { header: "Vendor", key: "vendor", width: 18 },
    { header: "Purchase Date", key: "purchaseDate", width: 14 },
    { header: "Purchase Cost", key: "purchaseCost", width: 14 },
    { header: "Warranty Expiry", key: "warrantyExpiry", width: 16 },
    { header: "AMC Expiry", key: "amcExpiry", width: 14 },
    { header: "Agent Enrolled", key: "agentEnrolled", width: 14 },
    { header: "Hostname", key: "hostname", width: 18 },
    { header: "CPU", key: "cpu", width: 28 },
    { header: "RAM (GB)", key: "ramGb", width: 10 },
    { header: "Storage (GB)", key: "storageGb", width: 12 },
    { header: "OS", key: "os", width: 24 },
    { header: "IP Address", key: "ipAddress", width: 16 },
    { header: "MAC Address", key: "macAddress", width: 18 },
    { header: "Last Check-in", key: "lastCheckInAt", width: 20 },
    { header: "Created At", key: "createdAt", width: 14 },
  ]
  sheet.getRow(1).font = { bold: true }

  for (const a of assets) {
    sheet.addRow({
      assetId: a.assetId,
      assetName: a.assetName,
      category: a.category,
      brand: a.brand ?? "",
      model: a.model ?? "",
      serialNumber: a.serialNumber ?? "",
      status: a.status,
      condition: a.condition,
      branch: a.branchId?.name ?? "",
      assignedTo: a.assignedTo?.name ?? "",
      assignedEmail: a.assignedTo?.email ?? "",
      vendor: a.vendor ?? "",
      purchaseDate: a.purchaseDate ? new Date(a.purchaseDate).toLocaleDateString() : "",
      purchaseCost: a.purchaseCost ?? 0,
      warrantyExpiry: a.warrantyExpiry ? new Date(a.warrantyExpiry).toLocaleDateString() : "",
      amcExpiry: a.amcExpiry ? new Date(a.amcExpiry).toLocaleDateString() : "",
      agentEnrolled: a.agent?.enrolled ? "Yes" : "No",
      hostname: a.agent?.hostname ?? "",
      cpu: a.agent?.cpu ?? "",
      ramGb: a.agent?.ramGb ?? "",
      storageGb: a.agent?.storageGb ?? "",
      os: a.agent?.os ?? "",
      ipAddress: a.agent?.ipAddress ?? "",
      macAddress: a.agent?.macAddress ?? "",
      lastCheckInAt: a.agent?.lastCheckInAt ? new Date(a.agent.lastCheckInAt).toLocaleString() : "",
      createdAt: new Date(a.createdAt).toLocaleDateString(),
    })
  }

  return workbook.xlsx.writeBuffer()
}
