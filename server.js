const express = require("express");
const axios = require("axios");
const cors = require("cors");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static("public"));

const CLIENT_CODE = process.env.CLIENT_CODE;
const USERNAME = process.env.ERPLY_USERNAME;
const PASSWORD = process.env.PASSWORD;
const ERPLY_URL = process.env.ERPLY_URL;

// --------------------------------------------------
// ERPLY SESSION
// --------------------------------------------------

let sessionKey = null;
let sessionExpiry = 0;

// --------------------------------------------------
// TODAY'S INVENTORY DATA
// --------------------------------------------------

let dailyRecord = {
    date: null,
    opening: null,
    checks: [],
    closing: null
};

// --------------------------------------------------
// VERIFY USER
// --------------------------------------------------

async function verifyUser() {

    if (
        sessionKey &&
        Date.now() < sessionExpiry
    ) {
        return sessionKey;
    }

    try {

        console.log("Authenticating with ERPLY...");

        const response = await axios.get(
            ERPLY_URL,
            {
                params: {
                    request: "verifyUser",
                    clientCode: CLIENT_CODE,
                    username: USERNAME,
                    password: PASSWORD
                }
            }
        );

        const data = response.data;

        if (
            !data?.status ||
            data.status.errorCode !== 0
        ) {
            throw new Error(
                data?.status?.errorMessage ||
                "ERPLY authentication failed"
            );
        }

        sessionKey =
            data.records?.[0]?.sessionKey;

        if (!sessionKey) {
            throw new Error(
                "No sessionKey returned by ERPLY."
            );
        }

        // Cache session for 55 minutes
        sessionExpiry =
            Date.now() +
            55 * 60 * 1000;

        console.log(
            "ERPLY authentication successful."
        );

        return sessionKey;

    } catch (error) {

        console.error(
            "verifyUser error:",
            error.response?.data ||
            error.message
        );

        throw error;
    }
}

// --------------------------------------------------
// ERPLY REQUEST
// --------------------------------------------------

async function erplyRequest(
    parameters,
    retry = true
) {

    try {

        const key =
            await verifyUser();

        const response =
            await axios.get(
                ERPLY_URL,
                {
                    params: {
                        clientCode: CLIENT_CODE,
                        sessionKey: key,
                        ...parameters
                    }
                }
            );

        const data =
            response.data;

        // Session expired
        if (
            data?.status?.errorCode === 1054 ||
            data?.status?.errorCode === 1055
        ) {

            if (retry) {

                console.log(
                    "ERPLY session expired. Re-authenticating..."
                );

                sessionKey = null;
                sessionExpiry = 0;

                return await erplyRequest(
                    parameters,
                    false
                );
            }
        }

        if (
            data?.status?.errorCode !== 0
        ) {

            throw new Error(
                data?.status?.errorMessage ||
                `ERPLY error code: ${data?.status?.errorCode}`
            );
        }

        return data;

    } catch (error) {

        console.error(
            "ERPLY request error:",
            error.response?.data ||
            error.message
        );

        throw error;
    }
}

// --------------------------------------------------
// GET WAREHOUSES
// --------------------------------------------------

async function getWarehouses() {

    const data =
        await erplyRequest({
            request: "getWarehouses"
        });

    return data.records || [];
}

// --------------------------------------------------
// GET TOTAL INVENTORY FOR LOCATION
// --------------------------------------------------

async function getWarehouseInventoryTotal(
    warehouseID
) {

    let pageNo = 1;

    const recordsOnPage = 1000;

    let totalQuantity = 0;
    let totalRecords = 0;

    while (true) {

        console.log(
            `Loading warehouse ${warehouseID}, page ${pageNo}...`
        );

        const data =
            await erplyRequest({

                request: "getProducts",

                warehouseID:
                    warehouseID,

                getStockInfo: 1,

                amountInStock: 1,

                pageNo: pageNo,

                recordsOnPage:
                    recordsOnPage
            });

        const records =
            data.records || [];

      
        if (records.length === 0) {
            break;
        }

        for (
            const product of records
        ) {

            let quantity = 0;

            // ERPLY warehouse stock
            if (
                product.warehouses &&
                product.warehouses[
                    warehouseID
                ]
            ) {

                const stock =
                    product.warehouses[
                        warehouseID
                    ];

                quantity = Number(
                    stock.totalInStock ??
                    stock.amountInStock ??
                    stock.inStock ??
                    0
                );
            }

            // Fallback
            if (
                quantity === 0 &&
                product.amountInStock !==
                    undefined
            ) {

                quantity =
                    Number(
                        product.amountInStock
                    ) || 0;
            }

            if (
                Number.isFinite(quantity)
            ) {

                totalQuantity +=
                    quantity;
            }
        }

        totalRecords +=
            records.length;

        if (
            records.length <
            recordsOnPage
        ) {
            break;
        }

        pageNo++;
    }

    console.log(
        `Warehouse ${warehouseID}: ` +
        `${totalRecords} products, ` +
        `${totalQuantity} units`
    );

    return totalQuantity;
}

// --------------------------------------------------
// FIND WAREHOUSE
// --------------------------------------------------

function findWarehouse(
    warehouses,
    names
) {

    return warehouses.find(
        warehouse => {

            const name =
                String(
                    warehouse.name ||
                    warehouse.warehouseName ||
                    ""
                )
                .trim()
                .toLowerCase();

            return names.some(
                possibleName =>
                    name ===
                    possibleName
                        .toLowerCase()
            );
        }
    );
}

// --------------------------------------------------
// GET CURRENT INVENTORY
// --------------------------------------------------

async function getInventorySnapshot() {

    const warehouses =
        await getWarehouses();

    console.log(
        "Warehouses returned by ERPLY:"
    );

    warehouses.forEach(
        warehouse => {

            console.log(
                `ID: ${
                    warehouse.id ||
                    warehouse.warehouseID
                } | Name: ${
                    warehouse.name ||
                    warehouse.warehouseName
                }`
            );
        }
    );

    const retail =
        findWarehouse(
            warehouses,
            ["Cole Haan Retail"]
        );

    const warehouse =
        findWarehouse(
            warehouses,
            ["Warehouse"]
        );

    const storeroom =
        findWarehouse(
            warehouses,
            ["Sandton Storeroom"]
        );

    if (!retail) {
        throw new Error(
            "Could not find Cole Haan Retail."
        );
    }

    if (!warehouse) {
        throw new Error(
            "Could not find Warehouse."
        );
    }

    if (!storeroom) {
        throw new Error(
            "Could not find Sandton Storeroom."
        );
    }

    const retailID =
        retail.id ||
        retail.warehouseID;

    const warehouseID =
        warehouse.id ||
        warehouse.warehouseID;

    const storeroomID =
        storeroom.id ||
        storeroom.warehouseID;

    const [
        retailTotal,
        warehouseTotal,
        storeroomTotal
    ] = await Promise.all([

        getWarehouseInventoryTotal(
            retailID
        ),

        getWarehouseInventoryTotal(
            warehouseID
        ),

        getWarehouseInventoryTotal(
            storeroomID
        )
    ]);

    const total =
        retailTotal +
        warehouseTotal +
        storeroomTotal;

    return {

        retail:
            retailTotal,

        warehouse:
            warehouseTotal,

        storeroom:
            storeroomTotal,

        total
    };
}

// --------------------------------------------------
// CURRENT DATE
// --------------------------------------------------

function getToday() {

    const now =
        new Date();

    return now
        .toLocaleDateString(
            "en-CA",
            {
                timeZone:
                    "Africa/Johannesburg"
            }
        );
}

// --------------------------------------------------
// TIMESTAMP
// --------------------------------------------------

function getTimestamp() {

    return new Date()
        .toLocaleString(
            "en-ZA",
            {
                timeZone:
                    "Africa/Johannesburg"
            }
        );
}

// --------------------------------------------------
// GENERATE OPENING FIGURES
// --------------------------------------------------

app.post(
    "/api/opening",
    async (req, res) => {

        try {

            const today =
                getToday();

            // Prevent duplicate opening
            if (
                dailyRecord.date === today &&
                dailyRecord.opening
            ) {

                return res.status(400)
                    .json({

                        success: false,

                        error:
                            "Opening figures have already been generated for today."
                    });
            }

            console.log(
                "Generating opening figures..."
            );

            const inventory =
                await getInventorySnapshot();

            dailyRecord = {

                date: today,

                opening: {

                    timestamp:
                        getTimestamp(),

                    ...inventory
                },

                checks: [],

                closing: null
            };

            res.json({

                success: true,

                opening:
                    dailyRecord.opening
            });

        } catch (error) {

            console.error(error);

            res.status(500)
                .json({

                    success: false,

                    error:
                        error.message
                });
        }
    }
);

// --------------------------------------------------
// CHECK CURRENT FIGURES
// --------------------------------------------------

app.post(
    "/api/current",
    async (req, res) => {

        try {

            const today =
                getToday();

            if (
                dailyRecord.date !== today ||
                !dailyRecord.opening
            ) {

                return res.status(400)
                    .json({

                        success: false,

                        error:
                            "Generate opening figures first."
                    });
            }

            console.log(
                "Checking current inventory..."
            );

            const inventory =
                await getInventorySnapshot();

            const check = {

                timestamp:
                    getTimestamp(),

                ...inventory
            };

            dailyRecord.checks.push(
                check
            );

            res.json({

                success: true,

                opening:
                    dailyRecord.opening,

                current:
                    check,

                checks:
                    dailyRecord.checks
            });

        } catch (error) {

            console.error(error);

            res.status(500)
                .json({

                    success: false,

                    error:
                        error.message
                });
        }
    }
);

// --------------------------------------------------
// CLOSE DAY
// --------------------------------------------------

app.post(
    "/api/closing",
    async (req, res) => {

        try {

            const today =
                getToday();

            if (
                dailyRecord.date !== today ||
                !dailyRecord.opening
            ) {

                return res.status(400)
                    .json({

                        success: false,

                        error:
                            "Generate opening figures first."
                    });
            }

            if (
                dailyRecord.closing
            ) {

                return res.status(400)
                    .json({

                        success: false,

                        error:
                            "The day has already been closed."
                    });
            }

            console.log(
                "Generating closing figures..."
            );

            const inventory =
                await getInventorySnapshot();

            dailyRecord.closing = {

                timestamp:
                    getTimestamp(),

                ...inventory
            };

            res.json({

                success: true,

                opening:
                    dailyRecord.opening,

                closing:
                    dailyRecord.closing
            });

        } catch (error) {

            console.error(error);

            res.status(500)
                .json({

                    success: false,

                    error:
                        error.message
                });
        }
    }
);

// --------------------------------------------------
// GET TODAY'S STATUS
// --------------------------------------------------

app.get(
    "/api/status",
    (req, res) => {

        res.json({

            success: true,

            record:
                dailyRecord
        });
    }
);

// --------------------------------------------------
// HEALTH CHECK
// --------------------------------------------------

app.get(
    "/api/health",
    (req, res) => {

        res.json({

            success: true,

            message:
                "Inventory Management server is running."
        });
    }
);

// --------------------------------------------------
// START SERVER
// --------------------------------------------------

app.listen(
    PORT,
    () => {

        console.log(
            `Inventory Management running on port ${PORT}`
        );

        console.log(
            `http://localhost:${PORT}`
        );
    }
);