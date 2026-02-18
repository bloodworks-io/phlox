// Helper functions to manage loading states with toast notifications
export const withLoading = async (loadingFn, setLoading) => {
    setLoading(true);
    try {
        await loadingFn();
    } finally {
        setLoading(false);
    }
};

export const createLoadingToast = (toast, message = "Loading...") => {
    return toast({
        title: message,
        status: "info",
        duration: null,
        isClosable: false,
    });
};
