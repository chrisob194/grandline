import React, { useState } from "react";
import { useInput, Box, Text } from "ink";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";

interface PathInputProps {
  placeholder?: string;
  directoriesOnly?: boolean;
  maxSuggestions?: number;
  onSubmit: (value: string) => void;
}

function expandTilde(value: string): string {
  if (value.startsWith("~/") || value === "~") {
    return os.homedir() + value.slice(1);
  }
  return value;
}

function getSuggestions(
  rawValue: string,
  directoriesOnly: boolean,
  maxSuggestions: number,
): string[] {
  const expanded = expandTilde(rawValue);

  let dir: string;
  let partial: string;

  if (expanded === "") {
    return [];
  } else if (expanded.endsWith("/")) {
    dir = expanded;
    partial = "";
  } else {
    dir = path.dirname(expanded);
    partial = path.basename(expanded);
  }

  // Don't try to list if dir is "." (relative path with no leading slash)
  if (!path.isAbsolute(dir)) {
    return [];
  }

  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return [];
  }

  const showHidden = partial.startsWith(".");

  return entries
    .filter((e) => {
      if (directoriesOnly && !e.isDirectory()) return false;
      if (!e.name.startsWith(partial)) return false;
      if (!showHidden && e.name.startsWith(".")) return false;
      return true;
    })
    .sort((a, b) => {
      // Directories first, then alphabetical
      if (a.isDirectory() !== b.isDirectory()) {
        return a.isDirectory() ? -1 : 1;
      }
      return a.name.localeCompare(b.name);
    })
    .slice(0, maxSuggestions)
    .map((e) => (e.isDirectory() ? e.name + "/" : e.name));
}

function joinPathWithSuggestion(rawValue: string, suggestion: string): string {
  if (rawValue.endsWith("/")) {
    return rawValue + suggestion;
  }
  const dir = path.dirname(rawValue);
  // Preserve ~ prefix
  const expandedDir = expandTilde(rawValue.startsWith("~") ? "~" + dir.slice(os.homedir().length) : dir);
  void expandedDir; // not used — we work with rawValue directly

  if (rawValue.startsWith("~/") || rawValue === "~") {
    const expandedRaw = expandTilde(rawValue);
    const expandedDirRaw = path.dirname(expandedRaw);
    const joined = expandedDirRaw + "/" + suggestion;
    // Convert back to ~
    const home = os.homedir();
    if (joined.startsWith(home + "/")) {
      return "~/" + joined.slice(home.length + 1);
    }
    return joined;
  }

  return dir + "/" + suggestion;
}

export function PathInput({
  placeholder,
  directoriesOnly = true,
  maxSuggestions = 8,
  onSubmit,
}: PathInputProps): React.ReactElement {
  const [value, setValue] = useState("");
  const [cursorOffset, setCursorOffset] = useState(0);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [isOpen, setIsOpen] = useState(false);

  function refreshSuggestions(newValue: string): void {
    const results = getSuggestions(newValue, directoriesOnly, maxSuggestions);
    setSuggestions(results);
    setSelectedIndex(-1);
    setIsOpen(results.length > 0);
  }

  useInput((input, key) => {
    if (key.escape) {
      setSuggestions([]);
      setSelectedIndex(-1);
      setIsOpen(false);
      return;
    }

    if (key.return) {
      if (isOpen && selectedIndex >= 0 && suggestions[selectedIndex]) {
        // Accept suggestion, don't submit
        const newValue = joinPathWithSuggestion(value, suggestions[selectedIndex]);
        setValue(newValue);
        setCursorOffset(newValue.length);
        // Immediately compute next completions
        refreshSuggestions(newValue);
      } else {
        onSubmit(expandTilde(value.trim()));
      }
      return;
    }

    if (key.tab || key.downArrow) {
      if (!isOpen && value.length > 0) {
        const results = getSuggestions(value, directoriesOnly, maxSuggestions);
        setSuggestions(results);
        setIsOpen(results.length > 0);
        setSelectedIndex(results.length > 0 ? 0 : -1);
      } else if (isOpen && suggestions.length > 0) {
        setSelectedIndex((prev) => (prev + 1) % suggestions.length);
      }
      return;
    }

    if (key.upArrow) {
      if (isOpen && suggestions.length > 0) {
        setSelectedIndex((prev) =>
          prev <= 0 ? suggestions.length - 1 : prev - 1,
        );
      }
      return;
    }

    if (key.leftArrow) {
      setCursorOffset((prev) => Math.max(0, prev - 1));
      return;
    }

    if (key.rightArrow) {
      setCursorOffset((prev) => Math.min(value.length, prev + 1));
      return;
    }

    if (key.backspace || key.delete) {
      if (cursorOffset > 0) {
        const newValue =
          value.slice(0, cursorOffset - 1) + value.slice(cursorOffset);
        setValue(newValue);
        setCursorOffset(cursorOffset - 1);
        refreshSuggestions(newValue);
      }
      return;
    }

    // Printable character
    if (input && !key.ctrl && !key.meta) {
      const newValue =
        value.slice(0, cursorOffset) + input + value.slice(cursorOffset);
      setValue(newValue);
      setCursorOffset(cursorOffset + input.length);
      refreshSuggestions(newValue);
    }
  });

  // Build cursor-aware char array
  const chars = value.split("");

  return (
    <Box flexDirection="column">
      <Box flexDirection="row">
        {chars.length === 0 ? (
          cursorOffset === 0 ? (
            <>
              <Text inverse>{placeholder ? placeholder[0] : " "}</Text>
              {placeholder && placeholder.length > 1 && (
                <Text dimColor>{placeholder.slice(1)}</Text>
              )}
            </>
          ) : null
        ) : (
          chars.map((char, i) =>
            i === cursorOffset ? (
              <Text key={i} inverse>
                {char}
              </Text>
            ) : (
              <Text key={i}>{char}</Text>
            ),
          )
        )}
        {chars.length > 0 && cursorOffset === chars.length && (
          <Text inverse> </Text>
        )}
      </Box>
      {isOpen &&
        suggestions.map((s, i) => (
          <Text key={s} color={i === selectedIndex ? "cyan" : undefined} dimColor={i !== selectedIndex}>
            {i === selectedIndex ? "› " : "  "}
            {s}
          </Text>
        ))}
      {isOpen && (
        <Text dimColor>↑↓/Tab navigate  Enter accept  Esc dismiss</Text>
      )}
    </Box>
  );
}
