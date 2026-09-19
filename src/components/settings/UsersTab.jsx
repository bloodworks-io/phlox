import { useCallback, useEffect, useState } from "react";
import { Box, Button, Flex, HStack, Input, NativeSelect, Text, VStack } from "@chakra-ui/react";
import { authApi } from "../../utils/api/authApi";

const UsersTab = () => {
  const [users, setUsers] = useState([]);
  const [me, setMe] = useState(null);
  const [newUsername, setNewUsername] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newRole, setNewRole] = useState("clinician");
  const [busy, setBusy] = useState(false);

  const reload = useCallback(async () => {
    try {
      const [meData, usersData] = await Promise.all([
        authApi.fetchMe().catch(() => null),
        authApi.fetchUsers().catch(() => null),
      ]);
      setMe(meData);
      setUsers(usersData || []);
    } catch {
      // Non-admin: tab is not rendered, but stay silent if reached anyway
    }
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  const handleCreate = async () => {
    if (!newUsername || !newPassword) return;
    setBusy(true);
    try {
      await authApi.createUser(newUsername, newPassword, newRole);
      setNewUsername("");
      setNewPassword("");
      await reload();
    } catch {
      // toast already raised by handleApiRequest
    } finally {
      setBusy(false);
    }
  };

  const handleResetPassword = async (user) => {
    const password = window.prompt(`New password for ${user.username}`);
    if (!password) return;
    try {
      await authApi.resetPassword(user.id, password);
    } catch {
      // toast already raised
    }
  };

  const handleToggleDisabled = async (user) => {
    try {
      await authApi.setDisabled(user.id, !user.disabled);
      await reload();
    } catch {
      // toast already raised
    }
  };

  return (
    <VStack gap={3} align="stretch">
      {users.map((user) => (
        <Flex
          key={user.id}
          justify="space-between"
          align="center"
          p={2}
          borderRadius="md"
          border="1px solid"
          borderColor="border"
        >
          <Box>
            <Text fontSize="sm" fontWeight="medium" color="textPrimary">
              {user.username}
              {me && user.id === me.id ? " (you)" : ""}
            </Text>
            <Text fontSize="xs" color="textSecondary">
              {user.role}
              {user.disabled ? " • disabled" : ""}
            </Text>
          </Box>
          <HStack gap={2}>
            <Button size="xs" variant="ghost" onClick={() => handleResetPassword(user)}>
              Reset password
            </Button>
            <Button
              size="xs"
              variant="ghost"
              disabled={me && user.id === me.id}
              onClick={() => handleToggleDisabled(user)}
            >
              {user.disabled ? "Enable" : "Disable"}
            </Button>
          </HStack>
        </Flex>
      ))}

      <HStack gap={2} pt={2} wrap="wrap">
        <Input
          size="sm"
          width="160px"
          placeholder="username"
          value={newUsername}
          onChange={(e) => setNewUsername(e.target.value)}
        />
        <Input
          size="sm"
          width="180px"
          type="password"
          placeholder="password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
        />
        <NativeSelect.Root size="sm" width="130px">
          <NativeSelect.Field value={newRole} onChange={(e) => setNewRole(e.target.value)}>
            <option value="clinician">clinician</option>
            <option value="admin">admin</option>
          </NativeSelect.Field>
        </NativeSelect.Root>
        <Button
          size="sm"
          className="green-button"
          loading={busy}
          disabled={!newUsername || !newPassword}
          onClick={handleCreate}
        >
          Add user
        </Button>
      </HStack>
    </VStack>
  );
};

export default UsersTab;
