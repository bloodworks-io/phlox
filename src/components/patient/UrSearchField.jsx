import { IconButton, Input } from "@chakra-ui/react";
import { useTranslation } from "react-i18next";
import { Tooltip } from '@/components/ui/tooltip';
import { SearchIcon } from "../common/icons";

const UrSearchField = ({
    value,
    onChange,
    onSearch,
    isLoading = false,
    size = "sm",
    autoFocus = false,
    placeholder,
}) => {
    const { t } = useTranslation();
    return (
        <>
            <Input
                placeholder={placeholder ?? t("patient.urNumberPlaceholder")}
                size={size}
                value={value || ""}
                onChange={onChange}
                autoFocus={autoFocus}
                className="input-style"
                css={{
                    borderTopLeftRadius: "md !important",
                    borderBottomLeftRadius: "md !important",
                    borderTopRightRadius: "0 !important",
                    borderBottomRightRadius: "0 !important"
                }}
            />
            <Tooltip content={t("patient.findExistingPatient")} positioning={{
                placement: "top"
            }}>
                <IconButton
                    type="button"
                    aria-label={t("patient.findExistingPatient")}
                    size={size}
                    loading={isLoading}
                    onClick={onSearch}
                    className="search-button"><SearchIcon /></IconButton>
            </Tooltip>
        </>
    );
};

export default UrSearchField;
