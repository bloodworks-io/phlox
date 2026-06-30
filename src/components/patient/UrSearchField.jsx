import { IconButton, Input } from "@chakra-ui/react";
import { Tooltip } from '@/components/ui/tooltip';
import { SearchIcon } from "../common/icons";

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
            css={{
                borderTopLeftRadius: "md !important",
                borderBottomLeftRadius: "md !important",
                borderTopRightRadius: "0 !important",
                borderBottomRightRadius: "0 !important"
            }}
        />
        <Tooltip content="Find existing patient by UR number" positioning={{
            placement: "top"
        }}>
            <IconButton
                type="button"
                aria-label="Find existing patient by UR number"
                size={size}
                loading={isLoading}
                onClick={onSearch}
                className="search-button"><SearchIcon /></IconButton>
        </Tooltip>
    </>
);

export default UrSearchField;
