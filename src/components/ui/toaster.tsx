"use client"

import {
    Toaster as ChakraToaster,
    Portal,
    createToaster,
} from "@chakra-ui/react";
import { CustomToast } from "../common/Toast";

export const toaster = createToaster({
    placement: "bottom",
    pauseOnPageIdle: true,
})

export const Toaster = () => {
    return (
        <Portal>
            <ChakraToaster toaster={toaster} insetInline={{ mdDown: "4" }} pointerEvents="none">
                {(toast) => (
                    <CustomToast
                        status={toast.type}
                        title={toast.title}
                        description={toast.description}
                        isClosable={toast.closable}
                        id={toast.id}
                        onClose={() => toaster.dismiss(toast.id)}
                    />
                )}
            </ChakraToaster>
        </Portal>
    )
}
