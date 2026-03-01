"use client";
import { useEffect } from "react";

function BootstrapClient() {
   useEffect(() => {
        require('bootstrap-italia/dist/js/bootstrap-italia.bundle.min.js');
    }, []);
    return null;
}

export default BootstrapClient;
