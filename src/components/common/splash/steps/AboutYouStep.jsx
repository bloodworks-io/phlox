import { useState } from "react";
import { VStack, HStack, Input, NativeSelect, Field } from "@chakra-ui/react";
import { Tooltip } from "@/components/ui/tooltip";
import { InfoIcon } from "../../icons";
import { SPECIALTIES } from "../../../../utils/constants";
import { validatePersonalStep } from "../../../../utils/splash/validators";

export const usePersonalStep = () => {
  const [name, setName] = useState("");
  const [specialty, setSpecialty] = useState("");

  return {
    name,
    setName,
    specialty,
    setSpecialty,
    validate: () => validatePersonalStep(name, specialty),
    getData: () => ({ name, specialty }),
  };
};

export const AboutYouStep = ({
  name,
  setName,
  specialty,
  setSpecialty,
  letters,
}) => (
  <VStack key="about-you" className="anim-fade-slide-right" gap={4} w="100%">
    <Field.Root required>
      <HStack>
        <Field.Label fontSize="sm" color="textSecondary">Your Name</Field.Label>
        <Tooltip content="Used to personalize your experience and generated documents" showArrow>
          <InfoIcon boxSize={3} color="textSecondary" />
        </Tooltip>
      </HStack>
      <Input
        placeholder="Ada Lovelace"
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="input-style"
        size="sm"
      />
    </Field.Root>

    <Field.Root required>
      <HStack>
        <Field.Label fontSize="sm" color="textSecondary">Your Specialty</Field.Label>
        <Tooltip content="Your medical specialty helps Phlox provide more relevant assistance" showArrow>
          <InfoIcon boxSize={3} color="textSecondary" />
        </Tooltip>
      </HStack>
      <NativeSelect.Root>
        <NativeSelect.Field
          placeholder="Select your specialty"
          value={specialty}
          onChange={(e) => setSpecialty(e.target.value)}
          className="input-style"
          size="sm"
        >
          {SPECIALTIES.map((spec) => (
            <option key={spec} value={spec}>{spec}</option>
          ))}
        </NativeSelect.Field>
        <NativeSelect.Indicator />
      </NativeSelect.Root>
    </Field.Root>

    {/* Letter template — optional */}
    {letters && letters.availableLetterTemplates.length > 0 && (
      <Field.Root>
        <HStack>
          <Field.Label fontSize="sm" color="textSecondary">Default Letter Template</Field.Label>
          <Tooltip content="Used when generating letters. Optional — you can set this later." showArrow>
            <InfoIcon boxSize={3} color="textSecondary" />
          </Tooltip>
        </HStack>
        <NativeSelect.Root>
          <NativeSelect.Field
            placeholder="Select a letter template"
            value={letters.selectedLetterTemplate}
            onChange={(e) => letters.setSelectedLetterTemplate(e.target.value)}
            className="input-style"
            size="sm"
          >
            {letters.availableLetterTemplates.map((t) => (
              <option key={t.id} value={t.id.toString()}>{t.name}</option>
            ))}
          </NativeSelect.Field>
          <NativeSelect.Indicator />
        </NativeSelect.Root>
      </Field.Root>
    )}
  </VStack>
);
