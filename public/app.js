const openingBtn =
    document.getElementById(
        "openingBtn"
    );

const currentBtn =
    document.getElementById(
        "currentBtn"
    );

const closingBtn =
    document.getElementById(
        "closingBtn"
    );

const loading =
    document.getElementById(
        "loading"
    );

const errorMessage =
    document.getElementById(
        "errorMessage"
    );

const statusPanel =
    document.getElementById(
        "statusPanel"
    );

const totalPanel =
    document.getElementById(
        "totalPanel"
    );


// --------------------------------------------------
// FORMAT NUMBER
// --------------------------------------------------

function formatNumber(number) {

    return Number(number)
        .toLocaleString("en-ZA");
}


// --------------------------------------------------
// FORMAT CHANGE
// --------------------------------------------------

function formatChange(number) {

    const value =
        Number(number);

    if (value > 0) {
        return `+${formatNumber(value)}`;
    }

    return formatNumber(value);
}


// --------------------------------------------------
// ERROR
// --------------------------------------------------

function showError(message) {

    errorMessage.textContent =
        message;

    errorMessage.classList.remove(
        "hidden"
    );
}

function hideError() {

    errorMessage.classList.add(
        "hidden"
    );

    errorMessage.textContent = "";
}


// --------------------------------------------------
// LOADING
// --------------------------------------------------

function setLoading(isLoading) {

    if (isLoading) {

        loading.classList.remove(
            "hidden"
        );

        openingBtn.disabled = true;
        currentBtn.disabled = true;
        closingBtn.disabled = true;

    } else {

        loading.classList.add(
            "hidden"
        );
    }
}


// --------------------------------------------------
// DISPLAY OPENING
// --------------------------------------------------

function displayOpening(opening) {

    statusPanel.classList.remove(
        "hidden"
    );

    totalPanel.classList.remove(
        "hidden"
    );

    document.getElementById(
        "openingTotal"
    ).textContent =
        formatNumber(
            opening.total
        );

    document.getElementById(
        "openingTime"
    ).textContent =
        opening.timestamp;


    // Retail

    document.getElementById(
        "retailOpening"
    ).textContent =
        formatNumber(
            opening.retail
        );


    // Warehouse

    document.getElementById(
        "warehouseOpening"
    ).textContent =
        formatNumber(
            opening.warehouse
        );


    // Storeroom

    document.getElementById(
        "storeroomOpening"
    ).textContent =
        formatNumber(
            opening.storeroom
        );
}


// --------------------------------------------------
// DISPLAY CURRENT
// --------------------------------------------------

function displayCurrent(
    opening,
    current
) {

    // Retail

    const retailChange =
        current.retail -
        opening.retail;

    document.getElementById(
        "retailCurrent"
    ).textContent =
        formatNumber(
            current.retail
        );

    document.getElementById(
        "retailChange"
    ).textContent =
        formatChange(
            retailChange
        );


    // Warehouse

    const warehouseChange =
        current.warehouse -
        opening.warehouse;

    document.getElementById(
        "warehouseCurrent"
    ).textContent =
        formatNumber(
            current.warehouse
        );

    document.getElementById(
        "warehouseChange"
    ).textContent =
        formatChange(
            warehouseChange
        );


    // Storeroom

    const storeroomChange =
        current.storeroom -
        opening.storeroom;

    document.getElementById(
        "storeroomCurrent"
    ).textContent =
        formatNumber(
            current.storeroom
        );

    document.getElementById(
        "storeroomChange"
    ).textContent =
        formatChange(
            storeroomChange
        );


    // Total

    const totalChange =
        current.total -
        opening.total;

    document.getElementById(
        "currentTotal"
    ).textContent =
        formatNumber(
            current.total
        );

    document.getElementById(
        "totalChange"
    ).textContent =
        formatChange(
            totalChange
        );


    document.getElementById(
        "lastChecked"
    ).textContent =
        `Last checked: ${current.timestamp}`;
}


// --------------------------------------------------
// LOAD EXISTING STATUS
// --------------------------------------------------

async function loadStatus() {

    try {

        const response =
            await fetch(
                "/api/status"
            );

        const data =
            await response.json();

        if (
            !data.success ||
            !data.record
        ) {
            return;
        }

        const record =
            data.record;

        // Only use today's record

        if (
            record.date !==
            getToday()
        ) {
            return;
        }

        if (record.opening) {

            displayOpening(
                record.opening
            );

            openingBtn.disabled =
                true;

            currentBtn.disabled =
                false;
        }

        if (
            record.checks &&
            record.checks.length > 0
        ) {

            displayCurrent(
                record.opening,

                record.checks[
                    record.checks.length - 1
                ]
            );
        }

        if (record.closing) {

            displayCurrent(
                record.opening,
                record.closing
            );

            openingBtn.disabled =
                true;

            currentBtn.disabled =
                true;

            closingBtn.disabled =
                true;
        }

    } catch (error) {

        console.error(
            "Status error:",
            error
        );
    }
}


// --------------------------------------------------
// TODAY
// --------------------------------------------------

function getToday() {

    const now =
        new Date();

    return now.toLocaleDateString(
        "en-CA",
        {
            timeZone:
                "Africa/Johannesburg"
        }
    );
}


// --------------------------------------------------
// GENERATE OPENING
// --------------------------------------------------

openingBtn.addEventListener(
    "click",
    async () => {

        hideError();

        setLoading(true);

        try {

            const response =
                await fetch(
                    "/api/opening",
                    {
                        method: "POST"
                    }
                );

            const data =
                await response.json();

            if (
                !response.ok ||
                !data.success
            ) {

                throw new Error(
                    data.error ||
                    "Could not generate opening figures."
                );
            }

            displayOpening(
                data.opening
            );

            openingBtn.disabled =
                true;

            currentBtn.disabled =
                false;

            closingBtn.disabled =
                false;

        } catch (error) {

            console.error(error);

            showError(
                error.message
            );

        } finally {

            setLoading(false);

            // Restore correct button states

            if (
                document.getElementById(
                    "openingTotal"
                ).textContent !== "0"
            ) {

                openingBtn.disabled =
                    true;

                currentBtn.disabled =
                    false;

                closingBtn.disabled =
                    false;
            }
        }
    }
);


// --------------------------------------------------
// CHECK CURRENT
// --------------------------------------------------

currentBtn.addEventListener(
    "click",
    async () => {

        hideError();

        setLoading(true);

        try {

            const response =
                await fetch(
                    "/api/current",
                    {
                        method: "POST"
                    }
                );

            const data =
                await response.json();

            if (
                !response.ok ||
                !data.success
            ) {

                throw new Error(
                    data.error ||
                    "Could not check current inventory."
                );
            }

            displayCurrent(
                data.opening,
                data.current
            );

        } catch (error) {

            console.error(error);

            showError(
                error.message
            );

        } finally {

            setLoading(false);

            currentBtn.disabled =
                false;

            closingBtn.disabled =
                false;
        }
    }
);


// --------------------------------------------------
// CLOSE DAY
// --------------------------------------------------

closingBtn.addEventListener(
    "click",
    async () => {

        const confirmed =
            confirm(
                "Are you sure you want to close today's inventory?"
            );

        if (!confirmed) {
            return;
        }

        hideError();

        setLoading(true);

        try {

            const response =
                await fetch(
                    "/api/closing",
                    {
                        method: "POST"
                    }
                );

            const data =
                await response.json();

            if (
                !response.ok ||
                !data.success
            ) {

                throw new Error(
                    data.error ||
                    "Could not close the day."
                );
            }

            displayCurrent(
                data.opening,
                data.closing
            );

            currentBtn.disabled =
                true;

            closingBtn.disabled =
                true;

        } catch (error) {

            console.error(error);

            showError(
                error.message
            );

        } finally {

            setLoading(false);
        }
    }
);


// --------------------------------------------------
// INITIALIZE
// --------------------------------------------------

loadStatus();