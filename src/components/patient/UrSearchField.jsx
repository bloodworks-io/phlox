import { IconButton, Input, Tooltip } from "@chakra-ui/react";
import { SearchIcon } from "@chakra-ui/icons";

const UrSearchField = ({
    value,
    onChange,
    onSearch,
    isLoading = false,
    size = "sm",
    autoFocus = false,
    placeholder = "UR Number",
}) => (
    <>
        <Input
            placeholder={placeholder}
            size={size}
            value={value || ""}
            onChange={onChange}
            autoFocus={autoFocus}
            className="input-style"
            sx={{
                borderTopLeftRadius: "md !important",
                borderBottomLeftRadius: "md !important",
                borderTopRightRadius: "0 !important",
                borderBottomRightRadius: "0 !important",
            }}
        />
        <Tooltip label="Find existing patient by UR number" placement="top">
            <IconButton
                type="button"
                icon={<SearchIcon />}
                aria-label="Find existing patient by UR number"
                size={size}
                isLoading={isLoading}
                onClick={onSearch}
                className="search-button"
            />
        </Tooltip>
    </>
);

export default UrSearchField;
