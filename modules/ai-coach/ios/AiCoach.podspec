require 'json'

package = JSON.parse(File.read(File.join(__dir__, '..', '..', '..', 'package.json')))

Pod::Spec.new do |s|
  s.name           = 'AiCoach'
  s.version        = '1.0.0'
  s.summary        = 'On-device AI focus-coach narration via Apple FoundationModels'
  s.description    = 'Rewrites weekly focus-coach insight prose on-device when Apple Intelligence is available.'
  s.author         = package['author'] || ''
  s.homepage       = package['homepage'] || 'https://bittersweet.app'
  s.license        = package['license'] || 'MIT'
  s.platforms      = { :ios => '15.1' }
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'SWIFT_COMPILATION_MODE' => 'wholemodule'
  }

  s.source_files = "**/*.{h,m,mm,swift,hpp,cpp}"
end
