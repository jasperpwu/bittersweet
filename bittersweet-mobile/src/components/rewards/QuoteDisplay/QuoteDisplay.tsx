import { FC } from 'react';
import { View } from 'react-native';
import { Typography } from '../../ui/Typography';
import { Card } from '../../ui/Card';

interface Quote {
  id: string;
  text: string;
  author: string;
  category?: string;
}

interface QuoteDisplayProps {
  quote: Quote;
  showAuthor?: boolean;
  variant?: 'card' | 'inline';
  onQuotePress?: () => void;
}


export const QuoteDisplay: FC<QuoteDisplayProps> = ({
  quote,
  showAuthor = true,
  variant = 'card',
  onQuotePress,
}) => {
  const content = (
    <View className="items-center">
      <Typography 
        variant="paragraph-14" 
        color="primary" 
        className="text-center mb-3 italic"
      >
        "{quote.text}"
      </Typography>
      {showAuthor && (
        <Typography 
          variant="body-12" 
          color="secondary" 
          className="text-center"
        >
          — {quote.author}
        </Typography>
      )}
      {quote.category && (
        <View className="mt-2 px-3 py-1 bg-primary/10 rounded-full">
          <Typography variant="tiny-10" color="primary">
            {quote.category}
          </Typography>
        </View>
      )}
    </View>
  );

  if (variant === 'card') {
    return (
      <Card 
        variant="default" 
        padding="medium" 
        className="mx-4"
        onTouchEnd={onQuotePress}
      >
        {content}
      </Card>
    );
  }

  return (
    <View className="px-4" onTouchEnd={onQuotePress}>
      {content}
    </View>
  );
};