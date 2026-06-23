// Action buttons for saving and restoring settings.
import { Steps, HStack, Button } from "@chakra-ui/react";

const SettingsActions = ({ onSave, onRestoreDefaults }) => {
    return (
        <HStack mt="2" gap="4" align="start">
            <Button onClick={onSave} className="green-button">
                Save Changes
            </Button>
            <Button onClick={onRestoreDefaults} className="red-button">
                Restore Defaults
            </Button>
        </HStack>
    );
};

export default SettingsActions;
