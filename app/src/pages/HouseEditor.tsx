import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from '@apollo/client';
import { GET_BOT_WITH_HOUSE } from '@/graphql/queries/bot';
import { PLACE_FURNITURE, UPDATE_HOUSE_SCORE } from '@/graphql/mutations/economy';
import { HousePlacementGrid } from '@/components/house/HousePlacementGrid';
import { FurnitureInventory } from '@/components/house/FurnitureInventory';
import { Button } from '@ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@ui/card';
import { Badge } from '@ui/badge';
import { toast } from 'sonner';
import {
  Home,
  Shield,
  Save,
  ArrowLeft,
  Sparkles,
  Info,
  Loader2,
  AlertCircle
} from 'lucide-react';
import { Alert, AlertDescription } from '@shared/components/ui/alert';
import { Progress } from '@shared/components/ui/progress';
import { Separator } from '@shared/components/ui/separator';

interface PlacedFurniture {
  id: string;
  name: string;
  type: string;
  position: { x: number; y: number; rotation: number };
  size: { width: number; height: number };
  scoreBonus: number;
  defenseBonus: number;
  rarity: string;
}

interface AvailableFurniture {
  id: string;
  name: string;
  furnitureType: string;
  rarity: string;
  scoreBonus: number;
  defenseBonus: number;
  size: { width: number; height: number };
  synergies?: string[];
  description?: string;
}

export default function HouseEditor() {
  const { botId } = useParams<{ botId: string }>();
  const navigate = useNavigate();
  
  const [placedFurniture, setPlacedFurniture] = useState<PlacedFurniture[]>([]);
  const [availableFurniture, setAvailableFurniture] = useState<AvailableFurniture[]>([]);
  const [selectedFurniture, setSelectedFurniture] = useState<PlacedFurniture | null>(null);
  const [draggingFurniture, setDraggingFurniture] = useState<AvailableFurniture | null>(null);
  const [hasChanges, setHasChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Queries
  const { data, loading, error } = useQuery(GET_BOT_WITH_HOUSE, {
    variables: { id: botId },
    skip: !botId,
  });

  // Mutations
  const [placeFurniture] = useMutation(PLACE_FURNITURE);
  const [updateHouseScore] = useMutation(UPDATE_HOUSE_SCORE);

  // Initialize data
  useEffect(() => {
    if (data?.bot?.house) {
      const house = data.bot.house;
      
      // Set placed furniture
      const placed = house.furniture?.filter((f: any) => f.position).map((f: any) => ({
        id: f.id,
        name: f.name,
        type: f.furnitureType,
        position: f.position,
        size: f.size || { width: 1, height: 1 },
        scoreBonus: f.scoreBonus || 0,
        defenseBonus: f.defenseBonus || 0,
        rarity: f.rarity || 'COMMON',
      })) || [];
      setPlacedFurniture(placed);

      // Set available furniture (unplaced items)
      const available = house.furniture?.filter((f: any) => !f.position).map((f: any) => ({
        id: f.id,
        name: f.name,
        furnitureType: f.furnitureType,
        rarity: f.rarity || 'COMMON',
        scoreBonus: f.scoreBonus || 0,
        defenseBonus: f.defenseBonus || 0,
        size: f.size || { width: 1, height: 1 },
        synergies: f.synergies || [],
        description: f.description,
      })) || [];
      setAvailableFurniture(available);
    }
  }, [data]);

  // Handle furniture update from grid
  const handleFurnitureUpdate = useCallback((updatedFurniture: PlacedFurniture[]) => {
    setPlacedFurniture(updatedFurniture);
    setHasChanges(true);
  }, []);

  // Handle drag start from inventory
  const handleDragStart = useCallback((furniture: AvailableFurniture) => {
    setDraggingFurniture(furniture);
  }, []);

  // Handle drag end
  const handleDragEnd = useCallback(() => {
    setDraggingFurniture(null);
  }, []);

  // Handle drop on grid
  const handleDrop = useCallback((e: React.DragEvent, position: { x: number; y: number }) => {
    e.preventDefault();
    
    const furnitureData = e.dataTransfer.getData('furniture');
    if (!furnitureData) return;
    
    const furniture: AvailableFurniture = JSON.parse(furnitureData);
    
    // Add to placed furniture
    const newPlacedFurniture: PlacedFurniture = {
      id: furniture.id,
      name: furniture.name,
      type: furniture.furnitureType,
      position: { x: position.x, y: position.y, rotation: 0 },
      size: furniture.size,
      scoreBonus: furniture.scoreBonus,
      defenseBonus: furniture.defenseBonus,
      rarity: furniture.rarity,
    };
    
    setPlacedFurniture([...placedFurniture, newPlacedFurniture]);
    setAvailableFurniture(availableFurniture.filter(f => f.id !== furniture.id));
    setHasChanges(true);
  }, [placedFurniture, availableFurniture]);

  // Save changes
  const handleSave = async () => {
    if (!hasChanges) return;
    
    setIsSaving(true);
    try {
      // Save all furniture positions
      const savePromises = placedFurniture.map(furniture =>
        placeFurniture({
          variables: {
            furnitureId: furniture.id,
            position: furniture.position,
          },
        })
      );
      
      // Also save furniture that was removed (null position)
      const removedFurniture = data?.bot?.house?.furniture?.filter((f: any) => 
        f.position && !placedFurniture.find(p => p.id === f.id)
      ) || [];
      
      const removePromises = removedFurniture.map((furniture: any) =>
        placeFurniture({
          variables: {
            furnitureId: furniture.id,
            position: null,
          },
        })
      );
      
      await Promise.all([...savePromises, ...removePromises]);
      
      // Update house score
      await updateHouseScore({
        variables: { botId },
      });
      
      toast.success('House layout saved successfully!');
      setHasChanges(false);
    } catch (error) {
      toast.error('Failed to save house layout');
      console.error('Save error:', error);
    } finally {
      setIsSaving(false);
    }
  };

  // Calculate stats
  const totalScore = placedFurniture.reduce((sum, f) => sum + f.scoreBonus, 0);
  const totalDefense = placedFurniture.reduce((sum, f) => sum + f.defenseBonus, 0);
  const baseScore = data?.bot?.house?.houseScore || 0;
  const baseDefense = data?.bot?.house?.defenseLevel || 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (error || !data?.bot) {
    return (
      <div className="container mx-auto p-6">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            {error ? 'Failed to load bot data' : 'Bot not found'}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const bot = data.bot;

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(`/bot/${botId}`)}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Home className="h-6 w-6" />
              House Editor
            </h1>
            <p className="text-muted-foreground">
              {bot.name} • #{bot.tokenId}
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          {hasChanges && (
            <Badge variant="outline" className="text-orange-500 border-orange-500">
              Unsaved changes
            </Badge>
          )}
          <Button
            onClick={handleSave}
            disabled={!hasChanges || isSaving}
          >
            {isSaving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Save Layout
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Base Score</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Home className="h-4 w-4 text-muted-foreground" />
              <span className="text-2xl font-bold">{baseScore}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Furniture Bonus</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-green-500" />
              <span className="text-2xl font-bold text-green-600">+{totalScore}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Base Defense</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-muted-foreground" />
              <span className="text-2xl font-bold">{baseDefense}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Defense Bonus</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-blue-500" />
              <span className="text-2xl font-bold text-blue-600">+{totalDefense}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Progress indicator */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Furniture Placed</span>
              <span className="text-muted-foreground">
                {placedFurniture.length} / {placedFurniture.length + availableFurniture.length} items
              </span>
            </div>
            <Progress 
              value={(placedFurniture.length / (placedFurniture.length + availableFurniture.length)) * 100} 
              className="h-2"
            />
          </div>
        </CardContent>
      </Card>

      {/* Editor Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* House Grid */}
        <div className="lg:col-span-2">
          <Card className="h-full">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>House Layout</span>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => toast.info('Drag furniture from inventory to place')}
                >
                  <Info className="h-4 w-4" />
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div 
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  const x = Math.floor((e.clientX - rect.left) / 50);
                  const y = Math.floor((e.clientY - rect.top) / 50);
                  handleDrop(e, { x, y });
                }}
              >
                <HousePlacementGrid
                  furniture={placedFurniture}
                  onFurnitureUpdate={handleFurnitureUpdate}
                  selectedFurniture={selectedFurniture}
                  onSelectFurniture={setSelectedFurniture}
                  isEditing={true}
                />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Furniture Inventory */}
        <div className="lg:col-span-1">
          <FurnitureInventory
            furniture={availableFurniture}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            selectedFurniture={draggingFurniture}
          />
        </div>
      </div>

      {/* Tips */}
      <Alert className="mt-6">
        <Info className="h-4 w-4" />
        <AlertDescription>
          <strong>Tips:</strong> Drag furniture from the inventory to place it in your house. 
          Click on placed furniture to select it, then use the rotate button or drag to move. 
          Furniture with matching types may provide synergy bonuses!
        </AlertDescription>
      </Alert>
    </div>
  );
}