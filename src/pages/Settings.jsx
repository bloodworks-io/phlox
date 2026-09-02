// Demo settings page — local models, doctor details, storage.
import { Box, Text } from "@chakra-ui/react";
import DemoSettingsPanel from "../components/settings/DemoSettingsPanel";

const Settings = () => (
    <Box p="5" borderRadius="sm" w="100%">
        <Text as="h2" mb="4">
            Settings
        </Text>
        <DemoSettingsPanel />
    </Box>
);

export default Settings;
