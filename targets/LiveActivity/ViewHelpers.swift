import SwiftUI

func resizableImage(imageName: String) -> some View {
  Image.dynamic(assetNameOrPath: imageName)
    .resizable()
    .aspectRatio(contentMode: .fit)
    .frame(maxWidth: .infinity, maxHeight: .infinity)
}
