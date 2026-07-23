import { Heading } from "@chakra-ui/react";

const ModalTitle = ({
    as = "h3",
    size = "xl",
    fontFamily = "heading",
    ...rest
}) => <Heading as={as} size={size} fontFamily={fontFamily} {...rest} />;

export default ModalTitle;
