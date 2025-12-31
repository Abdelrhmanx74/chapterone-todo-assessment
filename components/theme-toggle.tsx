import { MoonStarIcon, SunIcon } from 'lucide-react-native';
import { Button } from './ui/button';
import { Icon } from './ui/icon';
import { useColorScheme } from 'nativewind';

function ThemeToggle() {
  const { colorScheme, toggleColorScheme } = useColorScheme();

  const THEME_ICONS = {
    light: SunIcon,
    dark: MoonStarIcon,
  };

  return (
    <Button
      onPressIn={toggleColorScheme}
      size="icon"
      variant="ghost"
      className="ios:size-9 rounded-full web:mx-4">
      {colorScheme === 'light' ? (
        <Icon as={SunIcon} className="size-5" />
      ) : (
        <Icon as={MoonStarIcon} className="size-5" />
      )}
    </Button>
  );
}

export default ThemeToggle;
